const movementService = require("../services/movementService");
const movementModel = require("../models/movementModel");
const requestModel = require("../models/requestModel");
const maintenanceModel = require("../models/maintenanceModel");
const itemModel = require("../models/itemModel");
const systemModel = require("../models/systemModel");
const notificationService = require("../services/notificationService");
const { withTransaction, withSavepoint } = require("../config/db");

jest.mock("../config/db");
jest.mock("../models/movementModel");
jest.mock("../models/requestModel");
jest.mock("../models/maintenanceModel");
jest.mock("../models/itemModel");
jest.mock("../models/systemModel");
jest.mock("../services/notificationService", () => ({
  notifyTransferCreated: jest.fn(),
  notifyRequestCreated: jest.fn(),
  notifyRequestUpdated: jest.fn(),
  notifyTransferConfirmed: jest.fn(),
  notifyTransferRejected: jest.fn()
}));

describe("Movement Service", () => {
  const mockClient = {
    query: jest.fn()
  };

  const mockUser = {
    id: 1,
    role_code: "ADMIN",
    location_id: 1,
    active_location_id: 1
  };

  function setupDefaultMocks() {
    mockClient.query.mockResolvedValue({ rows: [] });
    withTransaction.mockImplementation(async (callback) => callback(mockClient));
    withSavepoint.mockImplementation(async (_client, callback) => callback());

    itemModel.getItemCategoryById.mockResolvedValue({
      id: 1,
      name: "Engine Oil",
      unit: "L"
    });

    systemModel.getSupplierById.mockResolvedValue({
      id: 1,
      name: "Default Supplier",
      location_id: 1
    });

    systemModel.getRecipientById.mockResolvedValue({
      id: 1,
      name: "Default Recipient",
      location_id: 1
    });

    systemModel.getLocationById.mockImplementation(async (id) => ({
      id,
      name: id === 2 ? "Annex Store" : "Main Store",
      is_active: true
    }));

    systemModel.getSectionById.mockResolvedValue(null);
    systemModel.getAssetById.mockResolvedValue({
      id: 1,
      name: "Generator",
      location_id: 1
    });

    movementModel.createMovementHeader.mockResolvedValue({
      id: 1,
      movement_type: "IN",
      location_id: 1,
      status: "COMPLETED"
    });
    movementModel.insertMovementItems.mockResolvedValue([]);
    movementModel.getMovementHeaderById.mockResolvedValue({
      id: 1,
      movement_type: "IN",
      location_id: 1,
      status: "COMPLETED",
      items: [{ item_id: 1, quantity: 10, cost: 100 }]
    });
    movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 100 });
    movementModel.getAverageUnitCost.mockResolvedValue(100);
    movementModel.upsertBalance.mockResolvedValue({ quantity: 100 });
    movementModel.createLedgerEntry.mockResolvedValue({});
    movementModel.createMovement.mockResolvedValue({
      id: 10,
      item_id: 1,
      location_id: 1,
      movement_type: "OUT",
      quantity: 1
    });
    movementModel.insertMovementLog.mockResolvedValue({});
    movementModel.deleteLedgerEntries.mockResolvedValue([]);
    movementModel.updateMovementHeader.mockResolvedValue({
      id: 40,
      item_id: 1,
      location_id: 1,
      movement_type: "OUT",
      quantity: 1,
      unit_cost: 100,
      status: "COMPLETED"
    });
    movementModel.replaceMovementItems.mockResolvedValue([]);
    movementModel.deleteMovement.mockResolvedValue({ id: 40 });

    requestModel.updateRequestStatus.mockResolvedValue({});
    requestModel.getRequestByIdWithClient.mockImplementation(async () => ({
      id: 1,
      request_number: "REQ-001",
      status: "APPROVED",
      requester_id: 2,
      location_id: 2,
      source_location_id: 1,
      location_name: "Annex Store",
      source_location_name: "Main Store"
    }));

    maintenanceModel.createMaintenanceLog.mockResolvedValue({
      id: 1,
      asset_id: 1,
      location_id: 1,
      description: "Routine service"
    });
    maintenanceModel.addMaintenanceItemUsed.mockResolvedValue({
      id: 1,
      maintenance_id: 1,
      movement_id: 10,
      item_id: 1,
      quantity: 2,
      unit_cost: 50
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  describe("stock movement", () => {
    test("creates an IN movement with item validation and ledger updates", async () => {
      const payload = {
        movement_type: "IN",
        items: [{ item_id: 1, quantity: 10, cost: 100 }],
        supplier_id: 1,
        reference: "PO-123"
      };
      const hydratedMovement = {
        id: 1,
        movement_type: "IN",
        location_id: 1,
        status: "COMPLETED",
        items: [{ item_id: 1, quantity: 10, cost: 100 }]
      };

      movementModel.createMovementHeader.mockResolvedValue({
        id: 1,
        movement_type: "IN",
        location_id: 1,
        status: "COMPLETED"
      });
      movementModel.getMovementHeaderById.mockResolvedValue(hydratedMovement);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 10 });

      const result = await movementService.recordMovement(payload, mockUser);

      expect(result).toEqual(hydratedMovement);
      expect(itemModel.getItemCategoryById).toHaveBeenCalledWith(1);
      expect(systemModel.getSupplierById).toHaveBeenCalledWith(1);
      expect(movementModel.createMovementHeader).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          movement_type: "IN",
          location_id: 1,
          supplier_id: 1,
          status: "COMPLETED"
        })
      );
      expect(movementModel.insertMovementItems).toHaveBeenCalledWith(
        mockClient,
        1,
        1,
        [{ item_id: 1, quantity: 10, cost: 100 }]
      );
      expect(movementModel.upsertBalance).toHaveBeenCalledWith(mockClient, 1, 1, 10);
      expect(movementModel.createLedgerEntry).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          item_id: 1,
          location_id: 1,
          movement_id: 1,
          quantity: 10,
          unit_cost: 100,
          total_cost: 1000
        })
      );
    });

    test("creates an OUT movement through the current multi-item movement path", async () => {
      const payload = {
        movement_type: "OUT",
        item_id: 1,
        quantity: 5,
        recipient_id: 1,
        reference: "JOB-456"
      };
      const hydratedMovement = {
        id: 2,
        movement_type: "OUT",
        location_id: 1,
        status: "COMPLETED",
        items: [{ item_id: 1, quantity: 5, cost: 0 }]
      };

      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 10 });
      movementModel.createMovementHeader.mockResolvedValue({
        id: 2,
        movement_type: "OUT",
        location_id: 1,
        status: "COMPLETED"
      });
      movementModel.getMovementHeaderById.mockResolvedValue(hydratedMovement);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 5 });

      const result = await movementService.recordMovement(payload, mockUser);

      expect(result).toEqual(hydratedMovement);
      expect(systemModel.getRecipientById).toHaveBeenCalledWith(1);
      expect(movementModel.createMovementHeader).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          movement_type: "OUT",
          location_id: 1,
          recipient_id: 1,
          item_id: 1,
          quantity: 5
        })
      );
      expect(movementModel.upsertBalance).toHaveBeenCalledWith(mockClient, 1, 1, -5);
    });

    test("creates a pending TRANSFER with resolved source cost and sends a transfer notification", async () => {
      const payload = {
        movement_type: "TRANSFER",
        destination_location_id: 2,
        items: [{ item_id: 1, quantity: 5 }],
        reference: "TRF-789"
      };
      const hydratedMovement = {
        id: 3,
        movement_type: "TRANSFER",
        status: "PENDING",
        source_location_id: 1,
        destination_location_id: 2,
        source_location_name: "Main Store",
        destination_location_name: "Annex Store",
        items: [{ item_id: 1, quantity: 5, cost: 100 }]
      };

      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 10 });
      movementModel.createMovementHeader.mockResolvedValue({
        id: 3,
        movement_type: "TRANSFER",
        status: "PENDING",
        source_location_id: 1,
        destination_location_id: 2
      });
      movementModel.getMovementHeaderById.mockResolvedValue(hydratedMovement);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 5 });

      const result = await movementService.recordMovement(payload, mockUser);

      expect(result).toEqual(hydratedMovement);
      expect(movementModel.createMovementHeader).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          movement_type: "TRANSFER",
          source_location_id: 1,
          destination_location_id: 2,
          status: "PENDING"
        })
      );
      expect(movementModel.insertMovementItems).toHaveBeenCalledWith(
        mockClient,
        3,
        1,
        [{ item_id: 1, quantity: 5, cost: 100 }]
      );
      expect(movementModel.upsertBalance).toHaveBeenCalledWith(mockClient, 1, 1, -5);
      expect(movementModel.createLedgerEntry).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          item_id: 1,
          location_id: 1,
          movement_id: 3,
          quantity: -5,
          unit_cost: 100,
          total_cost: -500
        })
      );
      expect(notificationService.notifyTransferCreated).toHaveBeenCalledWith(
        hydratedMovement,
        "Main Store",
        "Annex Store"
      );
    });

    test("rejects transfers to inactive destination locations", async () => {
      systemModel.getLocationById.mockImplementation(async (id) => ({
        id,
        name: id === 2 ? "Closed Store" : "Main Store",
        is_active: id !== 2
      }));

      await expect(
        movementService.recordMovement(
          {
            movement_type: "TRANSFER",
            destination_location_id: 2,
            items: [{ item_id: 1, quantity: 5 }]
          },
          mockUser
        )
      )
        .rejects
        .toThrow("Destination location is inactive");
      expect(movementModel.createMovementHeader).not.toHaveBeenCalled();
    });

    test("rejects an OUT movement when stock would go negative", async () => {
      const payload = {
        movement_type: "OUT",
        item_id: 1,
        quantity: 100,
        recipient_id: 1
      };

      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 5 });

      await expect(movementService.recordMovement(payload, mockUser))
        .rejects
        .toThrow("Insufficient stock for one or more movement items");
      expect(movementModel.createMovementHeader).not.toHaveBeenCalled();
      expect(movementModel.upsertBalance).not.toHaveBeenCalled();
    });
  });

  describe("request approval", () => {
    const pendingRequest = {
      id: 1,
      request_number: "REQ-001",
      status: "PENDING",
      requester_id: 2,
      location_id: 2,
      source_location_id: 1,
      location_name: "Annex Store",
      source_location_name: "Main Store"
    };

    test("approves a routed request by creating source OUT and destination IN movements", async () => {
      const requestItems = [{ item_id: 1, quantity: 5, unit_cost: 100 }];

      requestModel.getRequestByIdForUpdate.mockResolvedValue(pendingRequest);
      requestModel.getRequestItemsWithClient.mockResolvedValue(requestItems);
      movementModel.getBalanceForUpdate
        .mockResolvedValueOnce({ quantity: 20 })
        .mockResolvedValueOnce({ quantity: 0 });
      movementModel.createMovement
        .mockResolvedValueOnce({
          id: 11,
          item_id: 1,
          location_id: 1,
          movement_type: "OUT",
          quantity: 5
        })
        .mockResolvedValueOnce({
          id: 12,
          item_id: 1,
          location_id: 2,
          movement_type: "IN",
          quantity: 5
        });
      movementModel.upsertBalance
        .mockResolvedValueOnce({ quantity: 15 })
        .mockResolvedValueOnce({ quantity: 5 });

      const result = await movementService.approveRequest(1, mockUser, {
        reference: "APPROVED-001"
      });

      expect(result.status).toBe("APPROVED");
      expect(result.items).toEqual(requestItems);
      expect(result.results).toHaveLength(1);
      expect(movementModel.createMovement).toHaveBeenCalledTimes(2);
      expect(movementModel.createMovement).toHaveBeenNthCalledWith(
        1,
        mockClient,
        expect.objectContaining({
          item_id: 1,
          location_id: 1,
          movement_type: "OUT",
          destination_location_id: 2,
          request_id: 1
        })
      );
      expect(movementModel.createMovement).toHaveBeenNthCalledWith(
        2,
        mockClient,
        expect.objectContaining({
          item_id: 1,
          location_id: 2,
          movement_type: "IN",
          source_location_id: 1,
          request_id: 1
        })
      );
      expect(requestModel.updateRequestStatus).toHaveBeenCalledWith(
        mockClient,
        1,
        "APPROVED",
        { approvedBy: 1 }
      );
      expect(notificationService.notifyRequestUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, status: "APPROVED" }),
        "CONFIRMED"
      );
    });

    test("rejects approval for non-pending requests", async () => {
      requestModel.getRequestByIdForUpdate.mockResolvedValue({
        ...pendingRequest,
        status: "APPROVED"
      });

      await expect(movementService.approveRequest(1, mockUser))
        .rejects
        .toThrow("Only pending requests can be approved");
      expect(requestModel.updateRequestStatus).not.toHaveBeenCalled();
    });

    test("rejects approval when the source location has insufficient stock", async () => {
      requestModel.getRequestByIdForUpdate.mockResolvedValue(pendingRequest);
      requestModel.getRequestItemsWithClient.mockResolvedValue([
        { item_id: 1, quantity: 100, unit_cost: 100 }
      ]);
      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 5 });

      await expect(movementService.approveRequest(1, mockUser))
        .rejects
        .toThrow("Insufficient stock for this movement");
      expect(requestModel.updateRequestStatus).not.toHaveBeenCalled();
    });
  });

  describe("transfer receiving", () => {
    const destinationAdmin = {
      ...mockUser,
      active_location_id: 2
    };

    const pendingTransfer = {
      id: 30,
      movement_type: "TRANSFER",
      status: "PENDING",
      source_location_id: 1,
      destination_location_id: 2,
      source_location_name: "Main Store",
      destination_location_name: "Annex Store",
      reference: "TRF-030",
      created_by: 1,
      items: [{ id: 301, item_id: 1, quantity: 5, cost: 100 }]
    };

    test("confirms a pending transfer into the destination inventory", async () => {
      const completedTransfer = {
        ...pendingTransfer,
        status: "COMPLETED",
        transfer_confirmed_by: 1
      };

      movementModel.getMovementHeaderById
        .mockResolvedValueOnce(pendingTransfer)
        .mockResolvedValueOnce(completedTransfer);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 5 });
      movementModel.updateMovementStatus.mockResolvedValue(completedTransfer);

      const result = await movementService.confirmTransfer(30, destinationAdmin);

      expect(result).toEqual(completedTransfer);
      expect(movementModel.upsertBalance).toHaveBeenCalledWith(mockClient, 1, 2, 5);
      expect(movementModel.createLedgerEntry).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          item_id: 1,
          location_id: 2,
          movement_id: 30,
          quantity: 5,
          unit_cost: 100,
          total_cost: 500
        })
      );
      expect(movementModel.updateMovementStatus).toHaveBeenCalledWith(
        mockClient,
        30,
        "COMPLETED",
        expect.objectContaining({
          transfer_confirmed_by: 1,
          transfer_confirmed_at: expect.any(Date)
        })
      );
      expect(notificationService.notifyTransferConfirmed).toHaveBeenCalledWith(
        completedTransfer,
        "Main Store",
        "Annex Store"
      );
    });

    test("rejects a pending transfer and returns stock to the source inventory", async () => {
      const rejectedTransfer = {
        ...pendingTransfer,
        status: "REJECTED",
        transfer_confirmed_by: 1
      };

      movementModel.getMovementHeaderById
        .mockResolvedValueOnce(pendingTransfer)
        .mockResolvedValueOnce(rejectedTransfer);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 20 });
      movementModel.updateMovementStatus.mockResolvedValue(rejectedTransfer);

      const result = await movementService.rejectTransfer(30, destinationAdmin, "Damaged packaging");

      expect(result).toEqual(rejectedTransfer);
      expect(movementModel.upsertBalance).toHaveBeenCalledWith(mockClient, 1, 1, 5);
      expect(movementModel.createLedgerEntry).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          item_id: 1,
          location_id: 1,
          movement_id: 30,
          quantity: 5,
          unit_cost: 100,
          total_cost: 500
        })
      );
      expect(movementModel.updateMovementStatus).toHaveBeenCalledWith(
        mockClient,
        30,
        "REJECTED",
        expect.objectContaining({
          transfer_confirmed_by: 1,
          transfer_confirmed_at: expect.any(Date)
        })
      );
      expect(notificationService.notifyTransferRejected).toHaveBeenCalledWith(
        rejectedTransfer,
        "Main Store",
        "Annex Store"
      );
    });

    test("prevents source location admins from confirming destination receipt", async () => {
      movementModel.getMovementHeaderById.mockResolvedValueOnce(pendingTransfer);

      await expect(movementService.confirmTransfer(30, mockUser))
        .rejects
        .toThrow("Only destination admins can confirm this transfer");
      expect(movementModel.updateMovementStatus).not.toHaveBeenCalled();
    });
  });

  describe("movement modification permissions", () => {
    const editableMovement = {
      id: 40,
      item_id: 1,
      location_id: 1,
      movement_type: "OUT",
      quantity: 2,
      unit_cost: 100,
      reference: "OLD-OUT",
      recipient_id: 1,
      supplier_id: null,
      status: "COMPLETED",
      request_id: null,
      maintenance_usage_count: 0,
      items: [{ id: 401, item_id: 1, quantity: 2, cost: 100 }]
    };

    test("allows staff to edit assigned-location stock movements", async () => {
      const staffUser = {
        id: 7,
        role_code: "STAFF",
        location_id: 1,
        active_location_id: 1
      };
      const updatedMovement = {
        ...editableMovement,
        quantity: 1,
        reference: "UPDATED-OUT",
        items: [{ id: 402, item_id: 1, quantity: 1, cost: 100 }]
      };

      movementModel.getMovementHeaderById
        .mockResolvedValueOnce(editableMovement)
        .mockResolvedValueOnce(updatedMovement);
      movementModel.getBalanceForUpdate
        .mockResolvedValueOnce({ quantity: 4 })
        .mockResolvedValueOnce({ quantity: 6 });
      movementModel.upsertBalance
        .mockResolvedValueOnce({ quantity: 6 })
        .mockResolvedValueOnce({ quantity: 5 });
      movementModel.updateMovementHeader.mockResolvedValue(updatedMovement);

      const result = await movementService.updateMovement(
        40,
        {
          movement_type: "OUT",
          recipient_id: 1,
          reference: "UPDATED-OUT",
          items: [{ item_id: 1, quantity: 1, cost: 100 }]
        },
        staffUser
      );

      expect(result).toEqual(updatedMovement);
      expect(movementModel.updateMovementHeader).toHaveBeenCalledWith(
        mockClient,
        40,
        expect.objectContaining({
          movement_type: "OUT",
          location_id: 1,
          recipient_id: 1,
          supplier_id: null,
          reference: "UPDATED-OUT"
        })
      );
      expect(movementModel.replaceMovementItems).toHaveBeenCalledWith(
        mockClient,
        40,
        1,
        [{ item_id: 1, quantity: 1, cost: 100 }]
      );
    });

    test("prevents staff from deleting stock movements", async () => {
      const staffUser = {
        id: 7,
        role_code: "STAFF",
        location_id: 1,
        active_location_id: 1
      };

      movementModel.getMovementHeaderById.mockResolvedValueOnce(editableMovement);

      await expect(movementService.deleteMovement(40, staffUser))
        .rejects
        .toThrow("Staff cannot delete stock movements");
      expect(movementModel.deleteMovement).not.toHaveBeenCalled();
    });
  });

  describe("maintenance deduction", () => {
    test("logs maintenance and deducts the used item from inventory", async () => {
      const payload = {
        asset_id: 1,
        description: "Routine service",
        items_used: [{ item_id: 1, quantity: 2, unit_cost: 50 }]
      };

      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 10 });
      movementModel.getAverageUnitCost.mockResolvedValue(50);
      movementModel.createMovement.mockResolvedValue({
        id: 21,
        item_id: 1,
        location_id: 1,
        movement_type: "MAINTENANCE",
        quantity: 2
      });
      movementModel.upsertBalance.mockResolvedValue({ quantity: 8 });
      maintenanceModel.addMaintenanceItemUsed.mockResolvedValue({
        id: 1,
        maintenance_id: 1,
        movement_id: 21,
        item_id: 1,
        quantity: 2,
        unit_cost: 50
      });

      const result = await movementService.logMaintenance(payload, mockUser);

      expect(result).toEqual({
        id: 1,
        asset_id: 1,
        location_id: 1,
        description: "Routine service",
        items_used: [
          {
            id: 1,
            maintenance_id: 1,
            movement_id: 21,
            item_id: 1,
            quantity: 2,
            unit_cost: 50
          }
        ]
      });
      expect(systemModel.getAssetById).toHaveBeenCalledWith(1);
      expect(maintenanceModel.createMaintenanceLog).toHaveBeenCalledWith(
        mockClient,
        {
          asset_id: 1,
          location_id: 1,
          description: "Routine service",
          performed_by: 1
        }
      );
      expect(movementModel.createMovement).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          item_id: 1,
          location_id: 1,
          movement_type: "MAINTENANCE",
          quantity: 2,
          asset_id: 1
        })
      );
      expect(movementModel.upsertBalance).toHaveBeenCalledWith(mockClient, 1, 1, -2);
    });

    test("rejects maintenance when used items exceed available stock", async () => {
      const payload = {
        asset_id: 1,
        description: "Routine service",
        items_used: [{ item_id: 1, quantity: 50, unit_cost: 50 }]
      };

      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 5 });

      await expect(movementService.logMaintenance(payload, mockUser))
        .rejects
        .toThrow("Insufficient stock for this movement");
      expect(maintenanceModel.addMaintenanceItemUsed).not.toHaveBeenCalled();
    });
  });
});
