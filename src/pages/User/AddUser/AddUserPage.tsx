/** @format */

import { useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  UserPlus,
  Mail,
  User,
  Loader2,
  X,
} from "lucide-react";

import { message } from "antd";

import { AddUserAPI } from "@/services/Api/UserApi";

import "./AddUser.scss";

const AddUserPage = () => {
  const navigate = useNavigate();

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async (
    e: any,
  ) => {
    e.preventDefault();

    if (!name.trim()) {
      message.error(
        "Full name is required",
      );
      return;
    }

    if (!email.trim()) {
      message.error(
        "Email is required",
      );
      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      message.error(
        "Please enter a valid email address",
      );
      return;
    }

    try {
      setLoading(true);

      const res =
        await AddUserAPI({
          name,
          email,
        });

      message.success(
        res?.data?.message ||
          "User created successfully",
      );

      setTimeout(() => {
        navigate("/users");
      }, 1000);
    } catch (err: any) {
      message.error(
        err?.response?.data
          ?.message ||
          "Failed to create user",
      );
    } finally {
      setLoading(false);
    }
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
                below. Login
                credentials will be
                sent automatically
                to the user's email.
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
    </div>
  );
};

export default AddUserPage;