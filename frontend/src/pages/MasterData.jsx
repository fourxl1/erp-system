import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import TablePagination from "../components/TablePagination";
import { useActiveLocationId } from "../hooks/useActiveLocation";
import useSortedPagination from "../hooks/useSortedPagination";
import {
  createAsset,
  createCategory,
  createLocation,
  createRecipient,
  createSection,
  createSupplier,
  createUnit,
  createUser,
  deleteMasterData,
  fetchAssets,
  fetchCategories,
  fetchLocations,
  fetchRecipients,
  fetchSections,
  fetchSuppliers,
  fetchUnits,
  fetchUsers,
  updateAsset,
  updateCategory,
  updateLocation,
  updateRecipient,
  updateSection,
  updateSupplier,
  updateUnit,
  updateUser
} from "../services/api";
import { normalizeRoleName, readStoredUser } from "../utils/auth";

const SUPERADMIN_USER_ROLE_OPTIONS = ["Staff", "Admin", "SuperAdmin"];
const ADMIN_USER_ROLE_OPTIONS = ["Staff"];

function MasterData() {
  const currentUser = readStoredUser();
  const currentRole = normalizeRoleName(currentUser.role_name);
  const isSuperAdmin = currentRole === "superadmin";
  const canManageUsers = currentRole === "admin" || currentRole === "superadmin";
  const activeLocationId = useActiveLocationId();
  const userRoleOptions = isSuperAdmin ? SUPERADMIN_USER_ROLE_OPTIONS : ADMIN_USER_ROLE_OPTIONS;
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [users, setUsers] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);
  const [sections, setSections] = useState([]);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("categories");

  const [categoryForm, setCategoryForm] = useState({ id: null, name: "", description: "" });
  const [supplierForm, setSupplierForm] = useState({
    id: null,
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    notes: ""
  });
  const [userForm, setUserForm] = useState({
    id: null,
    full_name: "",
    email: "",
    password: "",
    role_name: "Staff",
    is_active: true
  });
  const [recipientForm, setRecipientForm] = useState({
    id: null,
    name: "",
    department: ""
  });
  const [unitForm, setUnitForm] = useState({ id: null, name: "", description: "" });
  const [locationForm, setLocationForm] = useState({
    id: null,
    name: "",
    code: "",
    address: "",
    is_active: true
  });
  const [sectionForm, setSectionForm] = useState({
    id: null,
    name: "",
    description: ""
  });
  const [assetForm, setAssetForm] = useState({
    id: null,
    asset_code: "",
    name: "",
    description: ""
  });

  const activeLocationName = useMemo(
    () => locations.find((entry) => String(entry.id) === String(activeLocationId))?.name || "Active Location",
    [activeLocationId, locations]
  );

  const tableSortConfig = useMemo(() => {
    switch (activeTab) {
      case "categories":
        return {
          options: [
            { value: "name", label: "Name" },
            { value: "description", label: "Description" }
          ],
          getSortValue: (row, key) => row?.[key]
        };
      case "units":
        return {
          options: [{ value: "name", label: "Unit Name" }],
          getSortValue: (row, key) => row?.[key]
        };
      case "locations":
        return {
          options: [
            { value: "name", label: "Name" },
            { value: "code", label: "Code" }
          ],
          getSortValue: (row, key) => row?.[key]
        };
      case "sections":
        return {
          options: [
            { value: "name", label: "Section" },
            { value: "location", label: "Location" }
          ],
          getSortValue: (row, key) => row?.[key]
        };
      case "assets":
        return {
          options: [
            { value: "asset_code", label: "Asset Code" },
            { value: "name", label: "Name" },
            { value: "location", label: "Location" }
          ],
          getSortValue: (row, key) => row?.[key]
        };
      case "suppliers":
        return {
          options: [
            { value: "name", label: "Supplier" },
            { value: "contact_name", label: "Contact" },
            { value: "phone", label: "Phone" }
          ],
          getSortValue: (row, key) => row?.[key]
        };
      case "users":
        return {
          options: [
            { value: "full_name", label: "Name" },
            { value: "email", label: "Email" },
            { value: "role_name", label: "Role" },
            { value: "location", label: "Location" }
          ],
          getSortValue: (row, key) => row?.[key]
        };
      case "recipients":
        return {
          options: [
            { value: "name", label: "Name" },
            { value: "department", label: "Department" }
          ],
          getSortValue: (row, key) => {
            if (key === "name") {
              return row?.name || row?.full_name;
            }

            if (key === "department") {
              return row?.department || row?.location;
            }

            return row?.[key];
          }
        };
      default:
        return {
          options: [{ value: "name", label: "Name" }],
          getSortValue: (row, key) => row?.[key]
        };
    }
  }, [activeTab]);

  const activeTabRows = useMemo(() => {
    if (activeTab === "categories") {
      return categories;
    }

    if (activeTab === "units") {
      return units;
    }

    if (activeTab === "locations") {
      return locations;
    }

    if (activeTab === "sections") {
      return sections;
    }

    if (activeTab === "assets") {
      return assets;
    }

    if (activeTab === "suppliers") {
      return suppliers;
    }

    if (activeTab === "users") {
      return users;
    }

    if (activeTab === "recipients") {
      return recipients;
    }

    return [];
  }, [activeTab, assets, categories, locations, recipients, sections, suppliers, units, users]);

  const masterTable = useSortedPagination(activeTabRows, {
    initialSortKey: tableSortConfig.options[0]?.value || null,
    initialSortDirection: "asc",
    initialPageSize: 10,
    getSortValue: tableSortConfig.getSortValue
  });
  const {
    setSortKey: setMasterSortKey,
    setSortDirection: setMasterSortDirection,
    setPage: setMasterPage
  } = masterTable;

  useEffect(() => {
    const defaultSortKey = tableSortConfig.options[0]?.value || null;
    setMasterSortKey(defaultSortKey);
    setMasterSortDirection("asc");
    setMasterPage(1);
  }, [activeTab, tableSortConfig.options, setMasterPage, setMasterSortDirection, setMasterSortKey]);

  function renderTableControls() {
    return (
      <div className="table-toolbar" style={{ marginTop: "0.75rem" }}>
        <span className="request-notice-card__meta">Rows: {masterTable.totalItems}</span>
        <div className="action-row">
          <select
            value={masterTable.sortKey || ""}
            onChange={(event) => {
              masterTable.setSortKey(event.target.value);
              masterTable.setPage(1);
            }}
          >
            {tableSortConfig.options.map((option) => (
              <option key={option.value} value={option.value}>
                Sort by {option.label}
              </option>
            ))}
          </select>
          <select
            value={masterTable.sortDirection}
            onChange={(event) => {
              masterTable.setSortDirection(event.target.value);
              masterTable.setPage(1);
            }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
    );
  }

  const resetUserForm = useCallback(() => {
    setUserForm({
      id: null,
      full_name: "",
      email: "",
      password: "",
      role_name: "Staff",
      is_active: true
    });
  }, []);

  const resetRecipientForm = useCallback(() => {
    setRecipientForm({
      id: null,
      name: "",
      department: ""
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [
        catData,
        supData,
        userData,
        recData,
        locData,
        unitData,
        secData,
        assetData
      ] = await Promise.all([
        fetchCategories(),
        fetchSuppliers(),
        canManageUsers ? fetchUsers() : Promise.resolve([]),
        fetchRecipients(),
        fetchLocations(),
        fetchUnits(),
        fetchSections(),
        fetchAssets()
      ]);

      setCategories(Array.isArray(catData) ? catData : []);
      setSuppliers(Array.isArray(supData) ? supData : []);
      setUsers(Array.isArray(userData) ? userData : []);
      setRecipients(Array.isArray(recData) ? recData : []);
      setLocations(Array.isArray(locData) ? locData : []);
      setUnits(Array.isArray(unitData) ? unitData : []);
      setSections(Array.isArray(secData) ? secData : []);
      setAssets(Array.isArray(assetData) ? assetData : []);
      setError("");
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Failed to load master data");
    }
  }, [canManageUsers]);

  useEffect(() => {
    void loadData();
  }, [activeLocationId, loadData]);

  const availableTabs = useMemo(
    () => [
      "categories",
      "units",
      ...(isSuperAdmin ? ["locations"] : []),
      "sections",
      "assets",
      "suppliers",
      ...(canManageUsers ? ["users"] : []),
      "recipients"
    ],
    [canManageUsers, isSuperAdmin]
  );

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const nextTab = availableTabs.includes(requestedTab) ? requestedTab : availableTabs[0];

    if (requestedTab !== nextTab) {
      setSearchParams({ tab: nextTab }, { replace: true });
      return;
    }

    if (activeTab !== nextTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, availableTabs, searchParams, setSearchParams]);

  useEffect(() => {
    if (!userForm.id) {
      setUserForm((current) => ({
        ...current,
        role_name: userRoleOptions.includes(current.role_name) ? current.role_name : "Staff"
      }));
    }
  }, [userForm.id, userForm.role_name, userRoleOptions]);

  async function handleAction(action, clearForm) {
    try {
      setLoading(true);
      await action();
      clearForm();
      await loadData();
      setError("");
    } catch (actionError) {
      setError(actionError.message || "Action failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(table, id) {
    const label =
      table === "users"
        ? "disable this user"
        : table === "recipients"
          ? "delete this recipient"
          : "delete this record";

    if (!window.confirm(`Are you sure you want to ${label}?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteMasterData(table, id);
      await loadData();

      if (table === "users" && Number(userForm.id) === Number(id)) {
        resetUserForm();
      }

      if (table === "recipients" && Number(recipientForm.id) === Number(id)) {
        resetRecipientForm();
      }

      setError("");
    } catch (deleteError) {
      setError(deleteError.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  function startEditingUser(user) {
    setUserForm({
      id: user.id,
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role_name: user.role_name || userRoleOptions[0] || "Staff",
      is_active: user.is_active !== false
    });
  }

  function startEditingRecipient(recipient) {
    setRecipientForm({
      id: recipient.id,
      name: recipient.name || recipient.full_name || "",
      department: recipient.department || recipient.location || ""
    });
  }

  function validateUserForm() {
    if (!userForm.full_name.trim()) {
      setError("Full name is required");
      return false;
    }

    if (!userForm.email.trim()) {
      setError("Email is required");
      return false;
    }

    if (!userForm.id && !userForm.password) {
      setError("Password is required for new users");
      return false;
    }

    if (normalizeRoleName(userForm.role_name) !== "superadmin" && !activeLocationId) {
      setError("Active location context is required for Admin and Staff users");
      return false;
    }

    return true;
  }

  return (
    <DashboardLayout>
      <div className="module-placeholder">
        <span className="module-placeholder__eyebrow">Administration</span>
        <h2>Master Data Management</h2>
        <p>Maintain the shared reference data and system entities.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

<div className="tabs-container">
  {availableTabs.map((tab) => (
    <button
      key={tab}
      className={`tab-button ${activeTab === tab ? "active" : ""}`}
      onClick={() => setSearchParams({ tab }, { replace: true })}
    >
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
    </button>
  ))}
</div>
  <div className="module-grid">

  {activeTab === "categories" && (
    <section className="module-placeholder">
      <h3>Categories</h3>
          <div className="admin-grid">
            <input
              placeholder="Name"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
            />
            <input
              placeholder="Description"
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm({ ...categoryForm, description: event.target.value })
              }
            />
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                handleAction(
                  () =>
                    categoryForm.id
                      ? updateCategory(categoryForm.id, categoryForm)
                      : createCategory(categoryForm),
                  () => setCategoryForm({ id: null, name: "", description: "" })
                )
              }
            >
              {categoryForm.id ? "Update" : "Add"}
            </button>
          </div>
          {renderTableControls()}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
  <table className="data-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Description</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {masterTable.pagedRows.map((category) => (
        <tr key={category.id} className="clickable-row">
          <td onClick={() => setCategoryForm(category)}>
            {category.name}
          </td>
          <td onClick={() => setCategoryForm(category)}>
            {category.description || "-"}
          </td>
          <td>
            <button
              className="secondary-button secondary-button--danger"
              onClick={() => handleDelete("categories", category.id)}
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
      <TablePagination
        page={masterTable.page}
        pageSize={masterTable.pageSize}
        totalItems={masterTable.totalItems}
        totalPages={masterTable.totalPages}
        onPageChange={masterTable.setPage}
        onPageSizeChange={masterTable.setPageSize}
      />
       </section>
  )}

      {activeTab === "units" && (
  <section className="module-placeholder">
    <h3>Units of Measure</h3>
          <div className="admin-grid">
            <input
              placeholder="Unit Name (e.g. PCS)"
              value={unitForm.name}
              onChange={(event) => setUnitForm({ ...unitForm, name: event.target.value })}
            />
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                handleAction(
                  () => (unitForm.id ? updateUnit(unitForm.id, unitForm) : createUnit(unitForm)),
                  () => setUnitForm({ id: null, name: "", description: "" })
                )
              }
            >
              {unitForm.id ? "Update" : "Add"}
            </button>
          </div>
          {renderTableControls()}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
  <table className="data-table">
    <thead>
      <tr>
        <th>Unit Name</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {masterTable.pagedRows.map((unit) => (
        <tr key={unit.id} className="clickable-row">
          <td onClick={() => setUnitForm(unit)}>
            {unit.name}
          </td>
          <td>
            <button
              className="secondary-button secondary-button--danger"
              onClick={() => handleDelete("units", unit.id)}
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
      <TablePagination
        page={masterTable.page}
        pageSize={masterTable.pageSize}
        totalItems={masterTable.totalItems}
        totalPages={masterTable.totalPages}
        onPageChange={masterTable.setPage}
        onPageSizeChange={masterTable.setPageSize}
      />
        </section>
)}
        {activeTab === "locations" && (
  <section className="module-placeholder">
    <h3>Locations (Stores)</h3>
          <div className="admin-grid">
            <input
              placeholder="Location Name"
              value={locationForm.name}
              onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })}
            />
            <input
              placeholder="Code"
              value={locationForm.code}
              onChange={(event) => setLocationForm({ ...locationForm, code: event.target.value })}
            />
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                handleAction(
                  () =>
                    locationForm.id
                      ? updateLocation(locationForm.id, locationForm)
                      : createLocation(locationForm),
                  () =>
                    setLocationForm({
                      id: null,
                      name: "",
                      code: "",
                      address: "",
                      is_active: true
                    })
                )
              }
            >
              {locationForm.id ? "Update" : "Add"}
            </button>
          </div>
          {renderTableControls()}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
  <table className="data-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Code</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {masterTable.pagedRows.map((location) => (
        <tr key={location.id} className="clickable-row">
          <td onClick={() => setLocationForm(location)}>
            {location.name}
          </td>
          <td onClick={() => setLocationForm(location)}>
            {location.code || "-"}
          </td>
          <td>
            <button
              className="secondary-button secondary-button--danger"
              onClick={() => handleDelete("locations", location.id)}
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
      <TablePagination
        page={masterTable.page}
        pageSize={masterTable.pageSize}
        totalItems={masterTable.totalItems}
        totalPages={masterTable.totalPages}
        onPageChange={masterTable.setPage}
        onPageSizeChange={masterTable.setPageSize}
      />
        </section>
        )}
        {activeTab === "sections" && (
  <section className="module-placeholder">
    <h3>Store Sections</h3>
          <div className="admin-grid">
            <div className="inventory-inline-chip">Location: {activeLocationName}</div>
            <input
              placeholder="Section Name"
              value={sectionForm.name}
              onChange={(event) => setSectionForm({ ...sectionForm, name: event.target.value })}
            />
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                handleAction(
                  () =>
                    sectionForm.id
                      ? updateSection(sectionForm.id, sectionForm)
                      : createSection(sectionForm),
                  () => setSectionForm({ id: null, name: "", description: "" })
                )
              }
            >
              {sectionForm.id ? "Update" : "Add"}
            </button>
          </div>
          {renderTableControls()}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
  <table className="data-table">
    <thead>
      <tr>
        <th>Section Name</th>
        <th>Location</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {masterTable.pagedRows.map((section) => (
        <tr key={section.id} className="clickable-row">
          <td onClick={() => setSectionForm(section)}>
            {section.name}
          </td>
          <td onClick={() => setSectionForm(section)}>
            {section.location || "-"}
          </td>
          <td>
            <button
              className="secondary-button secondary-button--danger"
              onClick={() => handleDelete("store_sections", section.id)}
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
      <TablePagination
        page={masterTable.page}
        pageSize={masterTable.pageSize}
        totalItems={masterTable.totalItems}
        totalPages={masterTable.totalPages}
        onPageChange={masterTable.setPage}
        onPageSizeChange={masterTable.setPageSize}
      />
        </section>
        )}
        {activeTab === "assets" && (
  <section className="module-placeholder module-placeholder--wide">
    <h3>Assets / Vehicles</h3>
          <div className="admin-grid admin-grid--assets">
            <div className="inventory-inline-chip">Location: {activeLocationName}</div>
            <input
              placeholder="Asset Code"
              value={assetForm.asset_code}
              onChange={(event) =>
                setAssetForm({ ...assetForm, asset_code: event.target.value })
              }
            />
            <input
              placeholder="Asset Name"
              value={assetForm.name}
              onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })}
            />
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                handleAction(
                  () => (assetForm.id ? updateAsset(assetForm.id, assetForm) : createAsset(assetForm)),
                  () =>
                    setAssetForm({
                      id: null,
                      asset_code: "",
                      name: "",
                      description: ""
                    })
                )
              }
            >
              {assetForm.id ? "Update" : "Add"}
            </button>
          </div>
         {renderTableControls()}
         <div className="table-wrap" style={{ marginTop: "1rem" }}>
  <table className="data-table">
    <thead>
      <tr>
        <th>Asset Code</th>
        <th>Name</th>
        <th>Location</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {masterTable.pagedRows.map((asset) => (
        <tr key={asset.id} className="clickable-row">
          <td onClick={() => setAssetForm(asset)}>
            {asset.asset_code}
          </td>
          <td onClick={() => setAssetForm(asset)}>
            {asset.name}
          </td>
          <td onClick={() => setAssetForm(asset)}>
            {asset.location || "-"}
          </td>
          <td>
            <button
              className="secondary-button secondary-button--danger"
              onClick={() => handleDelete("assets", asset.id)}
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
      <TablePagination
        page={masterTable.page}
        pageSize={masterTable.pageSize}
        totalItems={masterTable.totalItems}
        totalPages={masterTable.totalPages}
        onPageChange={masterTable.setPage}
        onPageSizeChange={masterTable.setPageSize}
      />
        </section>
        )}
        {activeTab === "suppliers" && (
  <section className="module-placeholder module-placeholder--wide">
    <h3>Suppliers</h3>
          <div className="admin-grid admin-grid--suppliers">
            <input
              placeholder="Supplier Name"
              value={supplierForm.name}
              onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })}
            />
            <input
              placeholder="Contact"
              value={supplierForm.contact_name}
              onChange={(event) =>
                setSupplierForm({ ...supplierForm, contact_name: event.target.value })
              }
            />
            <input
              placeholder="Phone"
              value={supplierForm.phone}
              onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })}
            />
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                handleAction(
                  () =>
                    supplierForm.id
                      ? updateSupplier(supplierForm.id, supplierForm)
                      : createSupplier(supplierForm),
                  () =>
                    setSupplierForm({
                      id: null,
                      name: "",
                      contact_name: "",
                      phone: "",
                      email: "",
                      notes: ""
                    })
                )
              }
            >
              {supplierForm.id ? "Update" : "Add"}
            </button>
          </div>
          {renderTableControls()}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterTable.pagedRows.map((supplier) => (
                  <tr key={supplier.id} className="clickable-row">
                    <td onClick={() => setSupplierForm(supplier)}>{supplier.name}</td>
                    <td onClick={() => setSupplierForm(supplier)}>{supplier.contact_name}</td>
                    <td onClick={() => setSupplierForm(supplier)}>{supplier.phone}</td>
                    <td>
                      <button
                        className="secondary-button secondary-button--danger"
                        onClick={() => handleDelete("suppliers", supplier.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={masterTable.page}
            pageSize={masterTable.pageSize}
            totalItems={masterTable.totalItems}
            totalPages={masterTable.totalPages}
            onPageChange={masterTable.setPage}
            onPageSizeChange={masterTable.setPageSize}
          />
        </section>
        )}
      {canManageUsers && activeTab === "users" && (
  <section className="module-placeholder module-placeholder--wide">
            <h3>Users</h3>
            <div className="admin-grid admin-grid--recipients">
              <div className="inventory-inline-chip">
                Active Location: {activeLocationName}
              </div>
              <input
                placeholder="Full Name"
                value={userForm.full_name}
                onChange={(event) =>
                  setUserForm({ ...userForm, full_name: event.target.value })
                }
              />
              <input
                placeholder="Email"
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
              />
              {!userForm.id ? (
                <input
                  type="password"
                  placeholder="Password"
                  value={userForm.password}
                  onChange={(event) =>
                    setUserForm({ ...userForm, password: event.target.value })
                  }
                />
              ) : null}
              <select
                value={userForm.role_name}
                onChange={(event) => setUserForm({ ...userForm, role_name: event.target.value })}
              >
                {userRoleOptions.map((roleName) => (
                  <option key={roleName} value={roleName}>
                    {roleName}
                  </option>
                ))}
              </select>
              <button
                className="primary-button"
                disabled={loading}
                onClick={() =>
                  validateUserForm() &&
                  handleAction(
                    () => (userForm.id ? updateUser(userForm.id, userForm) : createUser(userForm)),
                    resetUserForm
                  )
                }
              >
                {userForm.id ? "Update" : "Add"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={loading}
                onClick={resetUserForm}
              >
                Clear
              </button>
            </div>
            {renderTableControls()}
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masterTable.pagedRows.map((user) => (
                    <tr key={user.id} className="clickable-row">
                      <td onClick={() => startEditingUser(user)}>{user.full_name}</td>
                      <td onClick={() => startEditingUser(user)}>{user.email}</td>
                      <td onClick={() => startEditingUser(user)}>{user.role_name}</td>
                      <td onClick={() => startEditingUser(user)}>{user.location || "Global"}</td>
                      <td>
                        <button
                          className="secondary-button secondary-button--danger"
                          onClick={() => handleDelete("users", user.id)}
                        >
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={masterTable.page}
              pageSize={masterTable.pageSize}
              totalItems={masterTable.totalItems}
              totalPages={masterTable.totalPages}
              onPageChange={masterTable.setPage}
              onPageSizeChange={masterTable.setPageSize}
            />
          </section>
        ) }
        {activeTab === "recipients" && (
  <section className="module-placeholder module-placeholder--wide">
    <h3>Recipients</h3>
          
          <div className="admin-grid admin-grid--recipients">
            <input
              placeholder="Recipient Name"
              value={recipientForm.name}
              onChange={(event) =>
                setRecipientForm({ ...recipientForm, name: event.target.value })
              }
            />
            <input
              placeholder="Department"
              value={recipientForm.department}
              onChange={(event) =>
                setRecipientForm({ ...recipientForm, department: event.target.value })
              }
            />
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                handleAction(
                  () =>
                    recipientForm.id
                      ? updateRecipient(recipientForm.id, recipientForm)
                      : createRecipient(recipientForm),
                  resetRecipientForm
                )
              }
            >
              {recipientForm.id ? "Update" : "Add"}
            </button>
          </div>
          {renderTableControls()}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterTable.pagedRows.map((recipient) => (
                  <tr key={recipient.id} className="clickable-row">
                    <td onClick={() => startEditingRecipient(recipient)}>
                      {recipient.name || recipient.full_name}
                    </td>
                    <td onClick={() => startEditingRecipient(recipient)}>
                      {recipient.department || recipient.location || "Unassigned"}
                    </td>
                    <td>
                      <button
                        className="secondary-button secondary-button--danger"
                        onClick={() => handleDelete("recipients", recipient.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={masterTable.page}
            pageSize={masterTable.pageSize}
            totalItems={masterTable.totalItems}
            totalPages={masterTable.totalPages}
            onPageChange={masterTable.setPage}
            onPageSizeChange={masterTable.setPageSize}
          />
        </section>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MasterData;
