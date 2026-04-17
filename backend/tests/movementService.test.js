const movementService = require("../services/movementService");
const movementModel = require("../models/movementModel");
const requestModel = require("../models/requestModel");
const maintenanceModel = require("../models/maintenanceModel");
const itemModel = require("../models/itemModel");
const systemModel = require("../models/systemModel");
const { withTransaction } = require("../config/db");

// Mock dependencies
jest.mock("../config/db");
jest.mock("../models/movementModel");
jest.mock("../models/requestModel");
jest.mock("../models/maintenanceModel");
jest.mock("../models/itemModel");
jest.mock("../models/systemModel");
jest.mock("../services/notificationService");

// Mock withTransaction to return the result of the callback
withTransaction.mockImplementation(async (callback) => {
  return await callback({
    query: jest.fn()
  });
});

describe("Movement Service", () => {
  const mockUser = {
    id: 1,
    role_code: "ADMIN",
    location_id: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("stock movement", () => {
    test("should create IN movement successfully", async () => {
      const payload = {
        movement_type: "IN",
        location_id: 1,
        items: [
          { item_id: 1, quantity: 10, cost: 100 }
        ],
        supplier_id: 1,
        reference: "PO-123"
      };

      const mockMovement = { 
        id: 1, 
        movement_type: "IN", 
        location_id: 1,
        items: [
          { item_id: 1, quantity: 10, cost: 100 }
        ]
      };
      
      movementModel.createMovementHeader.mockResolvedValue(mockMovement);
      movementModel.insertMovementItems.mockResolvedValue(true);
      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 0 });
      movementModel.upsertBalance.mockResolvedValue({ quantity: 10 });
      movementModel.createLedgerEntry.mockResolvedValue(true);
      movementModel.getMovementHeaderById.mockResolvedValue(mockMovement);

      const result = await movementService.recordMovement(payload, mockUser);

      expect(result).toBeDefined();
      expect(movementModel.createMovementHeader).toHaveBeenCalled();
      expect(movementModel.insertMovementItems).toHaveBeenCalled();
    });

    test("should create OUT movement successfully", async () => {
      const payload = {
        movement_type: "OUT",
        location_id: 1,
        item_id: 1,
        quantity: 5,
        recipient_id: 1,
        reference: "JOB-456"
      };

      const mockMovement = { id: 2, movement_type: "OUT", quantity: 5 };
      
      movementModel.createMovement.mockResolvedValue(mockMovement);
      movementModel.getAverageUnitCost.mockResolvedValue(100);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 5 });
      movementModel.createLedgerEntry.mockResolvedValue(true);

      const result = await movementService.recordMovement(payload, mockUser);

      expect(result).toBeDefined();
      expect(movementModel.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movement_type: "OUT",
          location_id: 1,
          item_id: 1,
          quantity: 5
        })
      );
    });

    test("should create TRANSFER movement successfully", async () => {
      const payload = {
        movement_type: "TRANSFER",
        source_location_id: 1,
        destination_location_id: 2,
        items: [
          { item_id: 1, quantity: 5, cost: 100 }
        ],
        reference: "TRF-789"
      };

      const mockMovement = { 
        id: 3, 
        movement_type: "TRANSFER", 
        status: "PENDING",
        source_location_id: 1,
        destination_location_id: 2
      };
      
      movementModel.createMovementHeader.mockResolvedValue(mockMovement);
      movementModel.insertMovementItems.mockResolvedValue(true);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 5 });
      movementModel.createLedgerEntry.mockResolvedValue(true);

      const result = await movementService.recordMovement(payload, mockUser);

      expect(result).toBeDefined();
      expect(result.status).toBe("PENDING");
      expect(movementModel.createMovementHeader).toHaveBeenCalled();
    });

    test("should throw error for insufficient stock", async () => {
      const payload = {
        movement_type: "OUT",
        location_id: 1,
        item_id: 1,
        quantity: 100,
        recipient_id: 1
      };

      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 5 });
      movementModel.getAverageUnitCost.mockResolvedValue(100);

      await expect(movementService.recordMovement(payload, mockUser))
        .rejects
        .toThrow("Insufficient stock for this movement");
    });
  });

  describe("request approval", () => {
    test("should approve request successfully", async () => {
      const requestId = 1;
      const mockRequest = {
        id: 1,
        status: "PENDING",
        location_id: 1,
        items: [
          { item_id: 1, quantity: 5, unit_cost: 100 }
        ]
      };

      requestModel.getRequestById.mockResolvedValue(mockRequest);
      requestModel.updateRequestStatus.mockResolvedValue(true);
      movementModel.createMovement.mockResolvedValue({ id: 4, movement_type: "OUT" });
      movementModel.getAverageUnitCost.mockResolvedValue(100);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 5 });
      movementModel.createLedgerEntry.mockResolvedValue(true);

      const result = await movementService.approveRequest(requestId, mockUser);

      expect(result).toBeDefined();
      expect(requestModel.updateRequestStatus).toHaveBeenCalledWith(
        requestId,
        "APPROVED",
        expect.any(Object)
      );
    });

    test("should throw error for non-pending request", async () => {
      const requestId = 1;
      const mockRequest = {
        id: 1,
        status: "APPROVED",
        location_id: 1
      };

      requestModel.getRequestById.mockResolvedValue(mockRequest);

      await expect(movementService.approveRequest(requestId, mockUser))
        .rejects
        .toThrow("Only pending requests can be approved");
    });

    test("should throw error for insufficient stock during approval", async () => {
      const requestId = 1;
      const mockRequest = {
        id: 1,
        status: "PENDING",
        location_id: 1,
        items: [
          { item_id: 1, quantity: 100, unit_cost: 100 }
        ]
      };

      requestModel.getRequestById.mockResolvedValue(mockRequest);
      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 5 });
      movementModel.getAverageUnitCost.mockResolvedValue(100);

      await expect(movementService.approveRequest(requestId, mockUser))
        .rejects
        .toThrow("Insufficient stock for this request");
    });
  });

  describe("maintenance deduction", () => {
    test("should log maintenance and deduct stock successfully", async () => {
      const payload = {
        asset_id: 1,
        location_id: 1,
        description: "Routine service",
        items_used: [
          { item_id: 1, quantity: 2, unit_cost: 50 }
        ]
      };

      const mockMaintenance = { id: 1, asset_id: 1 };
      const mockMovement = { id: 5, movement_type: "MAINTENANCE" };
      
      maintenanceModel.createMaintenanceLog.mockResolvedValue(mockMaintenance);
      movementModel.createMovement.mockResolvedValue(mockMovement);
      movementModel.getAverageUnitCost.mockResolvedValue(50);
      movementModel.upsertBalance.mockResolvedValue({ quantity: 8 });
      movementModel.createLedgerEntry.mockResolvedValue(true);

      const result = await movementService.logMaintenance(payload, mockUser);

      expect(result).toBeDefined();
      expect(maintenanceModel.createMaintenanceLog).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: 1,
          location_id: 1,
          description: "Routine service"
        })
      );
    });

    test("should throw error for insufficient stock during maintenance", async () => {
      const payload = {
        asset_id: 1,
        location_id: 1,
        description: "Routine service",
        items_used: [
          { item_id: 1, quantity: 50, unit_cost: 50 }
        ]
      };

      maintenanceModel.createMaintenanceLog.mockResolvedValue({ id: 1 });
      movementModel.getBalanceForUpdate.mockResolvedValue({ quantity: 5 });
      movementModel.getAverageUnitCost.mockResolvedValue(50);

      await expect(movementService.logMaintenance(payload, mockUser))
        .rejects
        .toThrow("Insufficient stock for maintenance items");
    });
  });
});