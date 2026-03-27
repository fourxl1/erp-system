import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import ItemIdentity from "../components/ItemIdentity";
import {
  createItem,
  deleteItem,
  fetchCategories,
  fetchItems,
  fetchSuppliers,
  fetchUnits,
  updateItem
} from "../services/api";

const emptyForm = {
  id: null,
  name: "",
  category_id: "",
  supplier_id: "",
  unit: "",
  reorder_level: "",
  description: "",
  image: null
};

function Inventory() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  const unitsList = useMemo(
    () => [...new Set(units.map((u) => u.name).filter(Boolean))],
    [units]
  );

  const loadData = useCallback(async () => {
    try {
      const [itemData, categoryData, supplierData, unitData] = await Promise.all([
        fetchItems(),
        fetchCategories(),
        fetchSuppliers(),
        fetchUnits()
      ]);

      setItems(itemData.items || []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setUnits(Array.isArray(unitData) ? unitData : []);
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load inventory data");
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  }

  function handleEdit(item) {
    setFormData({
      id: item.id,
      name: item.name,
      category_id: item.category_id || "",
      supplier_id: item.supplier_id || "",
      unit: item.unit || "",
      reorder_level: item.reorder_level || "",
      description: item.description || "",
      image: null
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.unit.trim()) {
      setError("Item name and unit are required");
      return;
    }

    try {
      setLoading(true);
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== "") {
          form.append(key, value);
        }
      });

      if (formData.id) {
        await updateItem(formData.id, form);
      } else {
        await createItem(form);
      }

      setFormData(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save item");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this item?")) return;

    try {
      setLoading(true);
      await deleteItem(id);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete item");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const value = search.toLowerCase();
    return items.filter((item) => {
      return (
        item.name?.toLowerCase().includes(value) ||
        item.category?.toLowerCase().includes(value) ||
        item.supplier?.toLowerCase().includes(value)
      );
    });
  }, [items, search]);

  const heroStats = useMemo(
    () => [
      { label: "Items cataloged", value: items.length },
      { label: "Low stock items", value: items.filter(i => (i.current_quantity || 0) <= (i.reorder_level || 0)).length },
      { label: "Total categories", value: categories.length }
    ],
    [items, categories]
  );

  const overviewStats = useMemo(() => {
    const lowStockCount = filteredItems.filter(
      (item) => Number(item.current_quantity || 0) <= Number(item.reorder_level || 0)
    ).length;

    return [
      { label: "Visible items", value: filteredItems.length },
      { label: "Healthy stock", value: Math.max(filteredItems.length - lowStockCount, 0) },
      { label: "Low stock", value: lowStockCount }
    ];
  }, [filteredItems]);

  return (
    <DashboardLayout>
      <div className="inventory-shell space-y-8">
        <section className="inventory-hero">
          <div className="inventory-hero__content">
            <p className="inventory-hero__eyebrow">Store Center</p>
            <h2 className="inventory-hero__title">Manage your store.</h2>
            <p className="inventory-hero__copy">
              Monitor stock levels, suppliers, recipients and organize your items with ease.
            </p>
          </div>
          <div className="inventory-hero__stats">
            {heroStats.map((stat) => (
              <article key={stat.label} className="inventory-hero__stat-card">
                <p>{stat.label}</p>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
        </section>

        {error && (
          <div className="dashboard-card__alert dashboard-card__alert--error">
            <span>{error}</span>
            <button onClick={() => setError("")} className="alert-close">×</button>
          </div>
        )}

        <section className={`inventory-card ${showForm ? "inventory-card--expanded" : ""}`}>
          <div className="inventory-card__header">
            <div>
              <p className="dashboard-card__eyebrow">Item Management</p>
              <h3>{formData.id ? "Edit Item Details" : "Add New Item"}</h3>
            </div>
            <button
              type="button"
              className={`inventory-card__toggle ${showForm ? "active" : ""}`}
              onClick={() => {
                if (showForm && formData.id) setFormData(emptyForm);
                setShowForm((prev) => !prev);
              }}
            >
              {showForm ? "Cancel" : "+ Add Item"}
            </button>
          </div>

          {showForm && (
            <div className="inventory-card__body">
              <div className="inventory-form-groups">
                <div className="inventory-form-group">
                  <h4>Basic Information</h4>
                  <div className="inventory-form-grid">
                    <label className="field">
                      <span>Item Name/Details *</span>
                      <input
                        name="name"
                        placeholder="e.g. Industrial Drill"
                        className="inventory-input"
                        value={formData.name}
                        onChange={handleChange}
                      />
                    </label>

                    <label className="field">
                      <span>Category</span>
                      <select
                        name="category_id"
                        className="inventory-input"
                        value={formData.category_id}
                        onChange={handleChange}
                      >
                        <option value="">Select Category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Base Unit *</span>
                      <select
                        name="unit"
                        className="inventory-input"
                        value={formData.unit}
                        onChange={handleChange}
                      >
                        <option value="">Select Unit</option>
                        {unitsList.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="inventory-form-group">
                  <h4>More Info.</h4>
                  <div className="inventory-form-grid">
                    <label className="field">
                      <span>Preferred Supplier</span>
                      <select
                        name="supplier_id"
                        className="inventory-input"
                        value={formData.supplier_id}
                        onChange={handleChange}
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Reorder Level</span>
                      <input
                        type="number"
                        name="reorder_level"
                        className="inventory-input"
                        placeholder="e.g. 10"
                        value={formData.reorder_level}
                        onChange={handleChange}
                      />
                    </label>

                    <label className="field">
                      <span>Item Image</span>
                      <div className="file-input-wrapper">
                        <input
                          type="file"
                          className="inventory-input inventory-input--file"
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, image: event.target.files?.[0] || null }))
                          }
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="inventory-form-group inventory-form-group--full">
                  <h4>Additional Details</h4>
                  <label className="field">
                    <span>Description</span>
                    <textarea
                      name="description"
                      className="inventory-input inventory-input--textarea"
                      placeholder="Enter technical specifications or notes..."
                      value={formData.description}
                      onChange={handleChange}
                    />
                  </label>
                </div>
              </div>

              <div className="inventory-card__actions">
                <button
                  type="button"
                  className="primary-button primary-button--lift"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Processing..." : formData.id ? "Update Item" : "Create Item"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setFormData(emptyForm);
                    setShowForm(false);
                  }}
                  disabled={loading}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="inventory-panel">
          <div className="inventory-panel__header">
            <div className="inventory-panel__title">
              <p className="dashboard-card__eyebrow">Store Overview</p>
              <h3>All Items</h3>
            </div>
            <div className="inventory-panel__controls">
              <div className="search-wrapper">
                <input
                  className="inventory-search"
                  placeholder="Search by name, category, or supplier..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button className="search-clear" onClick={() => setSearch("")}>×</button>
                )}
              </div>
            </div>
          </div>

          <div className="inventory-panel__summary" aria-label="Store overview summary">
            {overviewStats.map((stat) => (
              <article key={stat.label} className="inventory-panel__summary-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>

          <div className="inventory-table-wrapper">
            <table className="inventory-table">
              <caption className="inventory-table__caption">
                Active inventory items with stock level, reorder point, and supplier details.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="inventory-table__serial">#</th>
                  <th scope="col">Item Identity</th>
                  <th scope="col">Category</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Unit</th>
                  <th scope="col" className="text-right">Available Qty</th>
                  <th scope="col" className="text-right">Reorder Level</th>
                  <th scope="col" className="text-center">Status</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item, index) => {
                    const isLowStock = (item.current_quantity || 0) <= (item.reorder_level || 0);
                    return (
                      <tr key={item.id} className={isLowStock ? "row-warning" : ""}>
                        <td className="inventory-table__serial">{index + 1}</td>
                        <td className="inventory-table__item-cell">
                          <ItemIdentity name={item.name} imagePath={item.image_url} compact />
                        </td>
                        <td>
                          <span className="badge-chip badge-chip--outline">{item.category || "Uncategorized"}</span>
                        </td>
                        <td>{item.supplier || "Not assigned"}</td>
                        <td>{item.unit || "-"}</td>
                        <td className="text-right">
                          <div className="inventory-table__metric">
                            <strong>{item.current_quantity ?? 0}</strong>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="inventory-table__metric">
                            <strong>{item.reorder_level ?? "-"}</strong>
                          </div>
                        </td>
                        <td className="text-center">
                          {isLowStock ? (
                            <span className="status-chip status-chip--rejected">Low Stock</span>
                          ) : (
                            <span className="status-chip status-chip--fulfilled">Healthy</span>
                          )}
                        </td>
                        <td className="inventory-table__actions">
                          <button 
                            className="action-btn action-btn--edit" 
                            onClick={() => handleEdit(item)} 
                            disabled={loading}
                            title="Edit Item"
                          >
                            Edit
                          </button>
                          <button 
                            className="action-btn action-btn--delete" 
                            onClick={() => handleDelete(item.id)} 
                            disabled={loading}
                            title="Delete Item"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="inventory-table__empty">
                      No items found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="inventory-mobile-list">
            {filteredItems.map((item) => {
              const isLowStock = (item.current_quantity || 0) <= (item.reorder_level || 0);
              return (
                <article key={item.id} className={`inventory-mobile-card ${isLowStock ? "inventory-mobile-card--warning" : ""}`}>
                  <div className="inventory-mobile-card__head">
                    <ItemIdentity name={item.name} imagePath={item.image_url} compact />
                    <div className="inventory-mobile-card__title-group">
                      <span className="badge-chip badge-chip--xsmall">{item.category}</span>
                      <p className="text-muted small">{item.supplier}</p>
                    </div>
                  </div>
                  <div className="inventory-mobile-card__meta">
                    <div className="meta-item">
                      <small>STOCK</small>
                      <strong>{item.current_quantity ?? 0} {item.unit}</strong>
                    </div>
                    <div className="meta-item">
                      <small>REORDER</small>
                      <strong>{item.reorder_level ?? "-"}</strong>
                    </div>
                    <div className="meta-item text-right">
                      <small>STATUS</small>
                      <span className={`status-dot ${isLowStock ? "status-dot--red" : "status-dot--green"}`}></span>
                    </div>
                  </div>
                  <div className="inventory-mobile-card__actions">
                    <button className="secondary-button secondary-button--small" onClick={() => handleEdit(item)} disabled={loading}>
                      Edit
                    </button>
                    <button className="secondary-button secondary-button--small secondary-button--danger" onClick={() => handleDelete(item.id)} disabled={loading}>
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default Inventory;
