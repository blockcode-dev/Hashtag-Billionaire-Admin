import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  AddAdminAPI,
  GetAdminDetailsAPI,
  GetDepartmentsAPI,
  GetRolesAPI,
  UpdateAdminAPI,
} from "@/services/Api/AdminApi";
import { User, Mail, ShieldCheck, ArrowLeft, Send, Building2, Lock } from "lucide-react";
import { SUPER_ADMIN_ROLE, getAdminId } from "@/lib/session";
import "./AddEditAdmin.scss";

type Option = { id: number; name: string };

// "User" is the customer role; it isn't an admin role. Super Admin is offered:
// a Super Admin can make other admins Super Admins (client decision Q44).
const HIDDEN_ROLES = ["User"];

const AddEditAdmin = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const isSelf = isEdit && String(id) === String(getAdminId());

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role_id: "",
    department_id: "",
  });
  const [currentRoleName, setCurrentRoleName] = useState("");
  const [roles, setRoles] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);

  // Nobody can change their own role (the backend answers 400), so the Super
  // Admin editing always stays one.
  const roleLocked = isSelf;

  const roleOptions = useMemo(
    () => roles.filter((r) => !HIDDEN_ROLES.includes(r.name)),
    [roles],
  );

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    if (id) loadAdmin();
  }, [id]);

  const loadOptions = async () => {
    try {
      const [rolesRes, departmentsRes] = await Promise.all([
        GetRolesAPI(),
        GetDepartmentsAPI(),
      ]);
      setRoles(rolesRes.data?.data || []);
      setDepartments(departmentsRes.data?.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load roles and departments");
    }
  };

  const loadAdmin = async () => {
    try {
      setLoading(true);
      const res = await GetAdminDetailsAPI(Number(id));
      const admin = res.data.data;
      setFormData({
        name: admin?.name || "",
        email: admin?.email || "",
        role_id: admin?.role_id ? String(admin.role_id) : "",
        department_id: admin?.department_id ? String(admin.department_id) : "",
      });
      setCurrentRoleName(admin?.admin_role?.name || "");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load admin");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.department_id || (!roleLocked && !formData.role_id)) {
      toast.error("Please choose a role and a department");
      return;
    }

    try {
      setLoading(true);
      if (isEdit) {
        await UpdateAdminAPI(Number(id), {
          name: formData.name.trim(),
          email: formData.email.trim(),
          department_id: Number(formData.department_id),
          ...(roleLocked ? {} : { role_id: Number(formData.role_id) }),
        });
        toast.success("Admin updated");
      } else {
        const res = await AddAdminAPI({
          name: formData.name.trim(),
          email: formData.email.trim(),
          role_id: Number(formData.role_id),
          department_id: Number(formData.department_id),
        });
        toast.success(
          res.data?.message ||
            "Admin created. They will receive an email to set their password.",
        );
      }
      navigate("/admins");
    } catch (err: any) {
      // 400: e.g. email already used by another admin. 403: role not allowed.
      toast.error(err?.response?.data?.message || "Failed to save admin");
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleName = roleLocked
    ? currentRoleName
    : roles.find((r) => String(r.id) === formData.role_id)?.name;

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
          <p>{isEdit ? "Update information for this administrator." : "Invite a new member to the management team."}</p>
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

            {/* Field: Email */}
            <div className="input-field">
              <label>Email Address</label>
              <div className="input-container">
                <Mail className="input-icon" size={18} />
                <input
                  type="email"
                  placeholder="admin@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Field: Role */}
            <div className={`input-field ${roleLocked ? "field-disabled" : ""}`}>
              <label>Role {roleLocked && "(Non-editable)"}</label>
              <div className="input-container">
                {roleLocked ? <Lock className="input-icon" size={18} /> : <ShieldCheck className="input-icon" size={18} />}
                {roleLocked ? (
                  <input type="text" value={currentRoleName} readOnly />
                ) : (
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    required
                  >
                    <option value="" disabled>
                      Select a role
                    </option>
                    {roleOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {isSelf && <p className="field-hint">You can't change your own role.</p>}
              {!roleLocked && selectedRoleName === SUPER_ADMIN_ROLE && (
                <p className="field-hint">
                  Super Admins can also add, edit and delete admins, other Super Admins included.
                </p>
              )}
            </div>

            {/* Field: Department */}
            <div className="input-field">
              <label>Department</label>
              <div className="input-container">
                <Building2 className="input-icon" size={18} />
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    Select a department
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!isEdit && (
              <div className="info-banner">
                <div className="info-icon"><Send size={16} /></div>
                <div className="info-text">
                  <h5>Invitation</h5>
                  <p>
                    The new admin will receive an email with a link to set their own password.
                    The link is valid for 72 hours. No password is sent.
                  </p>
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
              <h4>{selectedRoleName || "No role selected"}</h4>
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
