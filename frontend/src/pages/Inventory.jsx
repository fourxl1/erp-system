import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useActiveLocationId } from "../hooks/useActiveLocation";
import ItemIdentity from "../components/ItemIdentity";
import {
  createItem,
  deleteItem,
  fetchCategories,
  fetchItems,
  fetchSuppliers,
  fetchUploadedItemImages,
  fetchUnits,
  updateItem
} from "../services/api";
import { hasAllowedRole, readStoredUser } from "../utils/auth";

const emptyForm = {
  id: null,
  name: "",
  category_id: "",
  supplier_id: "",
  unit: "",
  reorder_level: "",
  description: "",
  image: null,
  image_path: ""
};

function getInventoryHealth(item) {
  const currentQuantity = Number(item.current_quantity || 0);
  const reorderLevel = Number(item.reorder_level || 0);

  if (currentQuantity <= reorderLevel) {
    return { label: "Low Stock", tone: "low" };
  }

  if (reorderLevel > 0 && currentQuantity <= reorderLevel * 1.5) {
    return { label: "Medium", tone: "medium" };
  }

  return { label: "Healthy", tone: "healthy" };
}

function Inventory() {
  const activeLocationId = useActiveLocationId();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  const unitsList = useMemo(
    () => [...new Set(units.map((unit) => unit.name).filter(Boolean))],
    [units]
  );
  const canManageItems = hasAllowedRole(readStoredUser(), ["admin", "superadmin"]);

  const loadData = useCallback(async () => {
    try {
      const [itemData, categoryData, supplierData, unitData, uploadedImageData] = await Promise.all([
        fetchItems(),
        fetchCategories(),
        fetchSuppliers(),
        fetchUnits(),
        canManageItems ? fetchUploadedItemImages() : Promise.resolve([])
      ]);

      setItems(itemData.items || []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setUnits(Array.isArray(unitData) ? unitData : []);
      setUploadedImages(Array.isArray(uploadedImageData) ? uploadedImageData : []);
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load inventory data");
    }
  }, [canManageItems]);

  useEffect(() => {
    void loadData();
  }, [activeLocationId, loadData]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
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
      image: null,
      image_path: item.image_path || ""
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
    if (!window.confirm("Delete this item?")) {
      return;
    }

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

    return items.filter((item) => (
      item.name?.toLowerCase().includes(value) ||
      item.category?.toLowerCase().includes(value) ||
      item.supplier?.toLowerCase().includes(value)
    ));
  }, [items, search]);

  const heroStats = useMemo(
    () => [
      { label: "Total Items", value: items.length },
      {
        label: "Low Stock",
        value: items.filter(
          (item) => Number(item.current_quantity || 0) <= Number(item.reorder_level || 0)
        ).length
      },
      { label: "Categories", value: categories.length }
    ],
    [items, categories]
  );

  return (
    <DashboardLayout>
      <div className="inventory-container">
        <div className="inventory-top-bar">
          <div className="inventory-top-bar__copy">
            <h1 className="inventory-page-title">Inventory</h1>
            <p className="inventory-page-subtitle">Manage stock levels and item details</p>
          </div>

          <button
            type="button"
            className="inventory-add-btn"
            onClick={() => {
              if (showForm && formData.id) {
                setFormData(emptyForm);
              }
              setShowForm((current) => !current);
            }}
            title="Add new item"
          >
            <span className="inventory-add-btn__icon" aria-hidden="true">
              +
            </span>
            <span>Add Item</span>
          </button>
        </div>

        {error ? (
          <div className="dashboard-card__alert dashboard-card__alert--error">
            <span>{error}</span>
            <button onClick={() => setError("")} className="alert-close">
              x
            </button>
          </div>
        ) : null}

        <section className="inventory-summary-strip" aria-label="Inventory summary">
          {heroStats.map((stat) => (
            <article key={stat.label} className="inventory-summary-card">
              <span className="inventory-summary-card__label">{stat.label}</span>
              <strong className="inventory-summary-card__value">{stat.value}</strong>
            </article>
          ))}
        </section>

        {showForm ? (
          <section className="inventory-form-section">
            <div className="form-header">
              <div>
                <h3>{formData.id ? "Edit Item" : "Add New Item"}</h3>
              </div>
              <button
                type="button"
                className="form-close-btn"
                onClick={() => {
                  setFormData(emptyForm);
                  setShowForm(false);
                }}
              >
                x
              </button>
            </div>

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
                          accept="image/jpeg,image/png,image/webp,image/bmp"
                          className="inventory-input inventory-input--file"
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              image: event.target.files?.[0] || null,
                              image_path: ""
                            }))
                          }
                        />
                      </div>
                    </label>

                    {uploadedImages.length > 0 ? (
                      <label className="field">
                        <span>Use Existing Upload</span>
                        <select
                          name="image_path"
                          className="inventory-input"
                          value={formData.image_path}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              image: null,
                              image_path: event.target.value
                            }))
                          }
                        >
                          <option value="">No existing image selected</option>
                          {uploadedImages.map((image) => (
                            <option key={image.filename} value={image.image_path}>
                              {image.filename}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
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
          </section>
        ) : null}

        <section className="inventory-items-section">
          <div className="items-header">
            <div>
              <h3 className="items-title">All Items</h3>
              <p className="items-subtitle">{filteredItems.length} items</p>
            </div>

            <div className="search-wrapper">
              <input
                className="inventory-search"
                placeholder="Search by name, category, or supplier..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search ? (
                <button className="search-clear" onClick={() => setSearch("")}>
                  x
                </button>
              ) : null}
            </div>
          </div>

          <div className="inventory-item-list">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const health = getInventoryHealth(item);

                return (
                  <article key={item.id} className="inventory-row-card">
                    <div className="inventory-row-card__left">
                      <div className="inventory-row-card__identity">
                        <ItemIdentity name={item.name} imagePath={item.image_url} compact />
                        <span className="inventory-row-card__category">
                          {item.category || "Uncategorized"}
                        </span>
                      </div>
                    </div>

                    <div className="inventory-row-card__center">
                      <div className="inventory-row-card__meta">
                        <span>Supplier</span>
                        <strong>{item.supplier || "Not assigned"}</strong>
                      </div>
                      <div className="inventory-row-card__meta">
                        <span>Unit</span>
                        <strong>{item.unit || "-"}</strong>
                      </div>
                      <div className="inventory-row-card__meta">
                        <span>Quantity</span>
                        <strong>{item.current_quantity ?? 0}</strong>
                      </div>
                      <div className="inventory-row-card__meta">
                        <span>Reorder Level</span>
                        <strong>{item.reorder_level ?? "-"}</strong>
                      </div>
                    </div>

                    <div className="inventory-row-card__right">
                      <span
                        className={`inventory-health-badge inventory-health-badge--${health.tone}`}
                      >
                        {health.label}
                      </span>

                      <div className="inventory-row-card__actions">
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
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="inventory-empty-state inventory-empty-state--panel">
                <p>No items found matching your search.</p>
              </div>
            )}
          </div>
        </section>

        <button
          className="inventory-fab-btn"
          onClick={() => {
            if (showForm && formData.id) {
              setFormData(emptyForm);
            }
            setShowForm((current) => !current);
          }}
          title="Add new item"
        >
          +
        </button>
      </div>
    </DashboardLayout>
  );
}

export default Inventory;
