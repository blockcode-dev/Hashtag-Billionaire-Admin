/** @format */

import { useState } from "react";

import { useNavigate } from "react-router";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  UserPlus,
  Mail,
  Phone,
  User,
  Loader2,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { AddUserAPI, type NewClient } from "@/services/Api/UserApi";
import { LoginDetailsPanel } from "../LoginDetailsPanel";

import "./AddUser.scss";

// The client just added, with the password the backend generated. It's shown once.
interface Added {
  client: NewClient;
  password: string;
  signInUrl: string | null;
}

const AddUserPage = () => {
  const navigate = useNavigate();

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [mobile, setMobile] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [added, setAdded] =
    useState<Added | null>(null);

  const handleSubmit = async (
    e: any,
  ) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(
        "Full name is required",
      );
      return;
    }

    if (!email.trim()) {
      toast.error(
        "Email is required",
      );
      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      toast.error(
        "Please enter a valid email address",
      );
      return;
    }

    try {
      setLoading(true);

      const res =
        await AddUserAPI({
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim() || undefined,
        });

      const data = res.data?.data;

      // A backend from before 27 Nov (hashtag-backend 56d96e1) sends no password back: it emails
      // the client a link to set their own instead.
      if (!data?.client || !data?.password) {
        toast.success(
          res?.data?.message ||
            "User created",
          {
            description: `${email.trim()} was emailed a link to set their own password.`,
          },
        );
        navigate("/users");
        return;
      }

      setAdded({
        client: data.client,
        password: data.password,
        signInUrl: data.sign_in_url ?? null,
      });

      toast.success(
        res?.data?.message ||
          "Client added",
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to create user",
      );
    } finally {
      setLoading(false);
    }
  };

  const addAnother = () => {
    setName("");
    setEmail("");
    setMobile("");
    setAdded(null);
  };

  return (
    <div className="add-user-root">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>Add New User</h1>

          <p>
            Create and onboard a
            new platform user
          </p>
        </div>

        <button
          className="btn-back"
          onClick={() =>
            navigate("/users")
          }
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* CARD */}
      {added ? (
        <div className="form-card">
          <div className="form-layout">
            {/* LEFT */}
            <div className="left-content">
              <h3 className="flex items-center gap-2">
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                {added.client.name} is added
              </h3>

              <p>
                Share their login details
                now: email them, or copy
                them to send yourself.
                The password can't be
                shown again. If it's
                lost, set a new one from
                Users.
              </p>
            </div>

            {/* RIGHT */}
            <div className="right-content">
              <LoginDetailsPanel
                clientId={added.client.id}
                login={{
                  name: added.client.name,
                  email: added.client.email,
                  password: added.password,
                  signInUrl: added.signInUrl,
                }}
              />
            </div>
          </div>

          {/* FOOTER */}
          <div className="form-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={addAnother}
            >
              <UserPlus size={16} />
              Add another
            </button>

            <button
              type="button"
              className="btn-submit"
              onClick={() =>
                navigate(`/users/${added.client.id}`)
              }
            >
              <Eye size={16} />
              View client
            </button>
          </div>
        </div>
      ) : (
        <div className="form-card">
          <form
            onSubmit={handleSubmit}
          >
            <div className="form-layout">
              {/* LEFT */}
              <div className="left-content">
                <h3>User Details</h3>

                <p>
                  Fill user details
                  below. The account is
                  created with a password,
                  and you can then email
                  the client their login
                  details or copy them to
                  send yourself.
                </p>
              </div>

              {/* RIGHT */}
              <div className="right-content">
                {/* NAME */}
                <div className="field">
                  <label>
                    Full Name
                  </label>

                  <div className="input-wrap">
                    <User size={18} />

                    <input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) =>
                        setName(
                          e.target
                            .value,
                        )
                      }
                    />
                  </div>
                </div>

                {/* EMAIL */}
                <div className="field">
                  <label>
                    Email Address
                  </label>

                  <div className="input-wrap">
                    <Mail size={18} />

                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) =>
                        setEmail(
                          e.target
                            .value,
                        )
                      }
                    />
                  </div>
                </div>

                {/* MOBILE */}
                <div className="field">
                  <label>
                    Mobile{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>

                  <div className="input-wrap">
                    <Phone size={18} />

                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="(832) 555-0123"
                      value={mobile}
                      onChange={(e) =>
                        setMobile(
                          e.target
                            .value,
                        )
                      }
                    />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    A 10-digit US number, in any format.
                  </p>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="form-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() =>
                  navigate("/users")
                }
              >
                <X size={16} />
                Cancel
              </button>

              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2
                      size={16}
                      className="spin"
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AddUserPage;
