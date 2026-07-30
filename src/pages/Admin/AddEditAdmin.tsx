import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AddAdminAPI, GetAdminDetailsAPI, UpdateAdminAPI } from "@/services/Api/AdminApi";
import { User, Mail, ShieldCheck, ArrowLeft, Send, CheckCircle2, Lock } from "lucide-react";
import "./AddEditAdmin.scss";

const AddEditAdmin = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "" });

  useEffect(() => {
    if (id) loadAdmin();
  }, [id]);

  const loadAdmin = async () => {
    try {
      setLoading(true);
      const res = await GetAdminDetailsAPI(Number(id));
      const admin = res.data.data;
      setFormData({ name: admin?.name || "", email: admin?.email || "" });
    } catch (err) {
      console.error("Failed to fetch admin:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isEdit) {
        // Only sending name since email is locked
        await UpdateAdminAPI(Number(id), { name: formData.name });
      } else {
        await AddAdminAPI(formData);
      }
      navigate("/admins");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-editor-wrapper">
      <nav className="editor-nav">
        <button className="back-link" onClick={() => navigate("/admins")}>
          <ArrowLeft size={18} />
          <span>Back to Administrators</span>
        </button>
      </nav>

      <div className="editor-content">
        <header className="content-header">
          <h1>{isEdit ? "Modify Profile" : "Onboard New Admin"}</h1>
          <p>{isEdit ? "Update basic information for this administrator." : "Invite a new member to the management team."}</p>
        </header>

        <form onSubmit={handleSubmit} className="glass-form">
          <div className="form-main">
            {/* Field: Full Name */}
            <div className="input-field">
              <label>Full Name</label>
              <div className="input-container">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Field: Email - READONLY ON EDIT */}
            <div className={`input-field ${isEdit ? "field-disabled" : ""}`}>
              <label>Email Address {isEdit && "(Non-editable)"}</label>
              <div className="input-container">
                {isEdit ? <Lock className="input-icon" size={18} /> : <Mail className="input-icon" size={18} />}
                <input
                  type="email"
                  placeholder="admin@company.com"
                  value={formData.email}
                  readOnly={isEdit}
                  onChange={(e) => !isEdit && setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              {isEdit && <p className="field-hint">Email addresses are tied to the account identity and cannot be changed.</p>}
            </div>

            {!isEdit && (
              <div className="info-banner">
                <div className="info-icon"><Send size={16} /></div>
                <div className="info-text">
                  <h5>Invitation Logic</h5>
                  <p>A setup link will be emailed to the user to create their password.</p>
                </div>
              </div>
            )}
          </div>

          <aside className="form-sidebar">
            <div className="role-preview">
              <div className="role-header">
                <ShieldCheck size={20} className="text-emerald" />
                <span>Access Level</span>
              </div>
              <h4>Super Administrator</h4>
              <div className="checklist">
                <div className="check-item"><CheckCircle2 size={14} /> Full System Access</div>
                <div className="check-item"><CheckCircle2 size={14} /> Audit Permissions</div>
              </div>
            </div>

            <div className="action-zone">
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update Changes" : "Send Invite"}
              </button>
              <button type="button" className="cancel-button" onClick={() => navigate("/admins")}>
                Cancel
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
};

export default AddEditAdmin;