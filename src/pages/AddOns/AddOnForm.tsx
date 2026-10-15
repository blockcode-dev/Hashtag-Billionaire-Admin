/** @format */

import { useEffect, useRef, useState } from "react";
import { message } from "antd";
import axios from "axios";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  Crop,
  PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  ArrowLeft,
  Check,
  Eye,
  ImagePlus,
  Info,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import {
  CreateAddOnProductAPI,
  GetAddOnProductByIdAPI,
  UpdateAddOnProductAPI,
} from "@/services/Api/AddOnApi";

import "./AddOn.scss";

import { IMAGE_BASE_URL } from "@/config/env";
const ASPECT_RATIO = 16 / 9;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

interface FieldErrors {
  name?: string;
  price?: string;
  image?: string;
}

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${IMAGE_BASE_URL}${path}`;
};

const getErrorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

const AddOnForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [features, setFeatures] = useState<string[]>([""]);

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hadImage, setHadImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Crop
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [fixedCropSize, setFixedCropSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [cropSaving, setCropSaving] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const featureRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndex = useRef<number | null>(null);

  /* ===========================
     LOAD (EDIT)
  =========================== */

  useEffect(() => {
    if (!isEdit || !id) return;

    const load = async () => {
      try {
        setFetching(true);

        const res = await GetAddOnProductByIdAPI(Number(id));
        const data = res.data?.data;

        if (!data) throw new Error("Add-on not found");

        let loadedFeatures = data.features;
        if (typeof loadedFeatures === "string") {
          try {
            loadedFeatures = JSON.parse(loadedFeatures);
          } catch {
            loadedFeatures = [];
          }
        }

        setName(data.name || "");
        setDescription(data.description || "");
        setPrice(data.price != null ? String(Number(data.price)) : "");
        setFeatures(
          Array.isArray(loadedFeatures) && loadedFeatures.length
            ? loadedFeatures
            : [""],
        );

        const image = getImageUrl(data.image);
        setPreviewUrl(image);
        setHadImage(!!image);
      } catch (err) {
        message.error(getErrorMessage(err, "Couldn't load this add-on."));
        navigate("/add-ons");
      } finally {
        setFetching(false);
      }
    };

    load();
  }, [id, isEdit, navigate]);

  // Focus a newly added feature input.
  useEffect(() => {
    if (focusIndex.current === null) return;
    featureRefs.current[focusIndex.current]?.focus();
    focusIndex.current = null;
  }, [features.length]);

  /* ===========================
     FEATURES
  =========================== */

  const updateFeature = (index: number, value: string) =>
    setFeatures((prev) => prev.map((f, i) => (i === index ? value : f)));

  const addFeature = (afterIndex = features.length - 1) => {
    focusIndex.current = afterIndex + 1;
    setFeatures((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, "");
      return next;
    });
  };

  const removeFeature = (index: number) =>
    setFeatures((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [""];
    });

  /* ===========================
     IMAGE + CROP
  =========================== */

  const handleFileSelected = (file?: File) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((p) => ({ ...p, image: "Use a PNG, JPG or WEBP image." }));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setErrors((p) => ({
        ...p,
        image: "This image is over 5 MB. Choose a smaller file.",
      }));
      return;
    }

    setErrors((p) => ({ ...p, image: undefined }));
    setPendingFile(file);
    setRawImageSrc(URL.createObjectURL(file));
  };

  const onCropImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;

    const initialCrop = centerCrop(
      makeAspectCrop({ unit: "%", width: 95 }, ASPECT_RATIO, width, height),
      width,
      height,
    );

    setCrop(initialCrop);
    // Ready to save straight away without touching the box.
    setCompletedCrop(convertToPixelCrop(initialCrop, width, height));

    // Lock the box to this size: it can be moved, not resized.
    setFixedCropSize({
      width: (initialCrop.width / 100) * width,
      height: (initialCrop.height / 100) * height,
    });
  };

  const closeCropModal = () => {
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
    setPendingFile(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setFixedCropSize(null);
  };

  const handleCropConfirm = async () => {
    const image = imgRef.current;

    if (!image || !pendingFile || !completedCrop?.width) {
      closeCropModal();
      return;
    }

    setCropSaving(true);

    try {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(completedCrop.width * scaleX);
      canvas.height = Math.round(canvas.width / ASPECT_RATIO); // exact 16:9

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser can't process this image.");

      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // Keep PNG as PNG (transparency), everything else as JPEG.
      const type = pendingFile.type === "image/png" ? "image/png" : "image/jpeg";

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Couldn't crop image."))),
          type,
          0.92,
        ),
      );

      const cropped = new File([blob], pendingFile.name, { type });

      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);

      setImageFile(cropped);
      setPreviewUrl(URL.createObjectURL(cropped));
      closeCropModal();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Couldn't crop image.");
    } finally {
      setCropSaving(false);
    }
  };

  const removeImage = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
  };

  /* ===========================
     SUBMIT
  =========================== */

  const validate = () => {
    const next: FieldErrors = {};

    if (!name.trim()) next.name = "Enter a name for this add-on.";

    if (price === "") next.price = "Enter a base price (use 0 for free).";
    else if (!Number.isFinite(Number(price)) || Number(price) < 0)
      next.price = "Price must be 0 or more.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      message.error("Please fix the highlighted fields.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("price", String(Number(price)));
    formData.append(
      "features",
      JSON.stringify(features.map((f) => f.trim()).filter(Boolean)),
    );

    if (imageFile) formData.append("images", imageFile);
    else if (isEdit && hadImage && !previewUrl)
      formData.append("remove_image", "true");

    try {
      setSaving(true);

      if (isEdit && id) {
        await UpdateAddOnProductAPI(Number(id), formData);
        message.success("Add-on saved");
      } else {
        await CreateAddOnProductAPI(formData);
        message.success("Add-on created");
      }

      navigate("/add-ons");
    } catch (err) {
      message.error(getErrorMessage(err, "Couldn't save the add-on. Try again."));
    } finally {
      setSaving(false);
    }
  };

  /* ===========================
     RENDER
  =========================== */

  if (fetching) {
    return (
      <div className="addon">
        <div className="addon__card addon__loading addon__loading--page">
          <span className="addon__spinner" />
          Loading add-on…
        </div>
      </div>
    );
  }

  return (
    <div className="addon">
      {/* HEADER */}
      <div className="addon__form-header">
        <button className="addon__back" onClick={() => navigate("/add-ons")}>
          <ArrowLeft size={15} />
          Add-ons
        </button>
        <h1>{isEdit ? "Edit add-on" : "New add-on"}</h1>
        <p>
          {isEdit
            ? "Changes apply to every product this add-on is attached to."
            : "Create it once here, then attach it to any product."}
        </p>
      </div>

      <form className="addon__form" onSubmit={handleSubmit} noValidate>
        {/* BASIC INFO */}
        <section className="addon__section">
          <h2 className="addon__section-title">Basic info</h2>

          <div className="addon__field">
            <label htmlFor="addon-name">
              Name <span className="addon__req">*</span>
            </label>
            <input
              id="addon-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
              placeholder="e.g. Standard individual bagging"
              className={errors.name ? "addon__input--error" : ""}
              aria-invalid={!!errors.name}
              autoFocus={!isEdit}
            />
            {errors.name && <span className="addon__error">{errors.name}</span>}
          </div>

          <div className="addon__field">
            <label htmlFor="addon-desc">
              Description <span className="addon__optional">(optional)</span>
            </label>
            <textarea
              id="addon-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the customer gets, in a sentence or two."
              rows={4}
            />
          </div>
        </section>

        {/* PRICING */}
        <section className="addon__section">
          <h2 className="addon__section-title">Pricing</h2>

          <div className="addon__field addon__field--narrow">
            <label htmlFor="addon-price">
              Base price <span className="addon__req">*</span>
            </label>
            <div
              className={`addon__price-input ${
                errors.price ? "addon__input--error" : ""
              }`}
            >
              <span>$</span>
              <input
                id="addon-price"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  // digits + one dot, max 2 decimals
                  const v = e.target.value.replace(/[^\d.]/g, "");
                  const [whole, ...rest] = v.split(".");
                  setPrice(
                    rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole,
                  );
                  if (errors.price)
                    setErrors((p) => ({ ...p, price: undefined }));
                }}
                // "0100" → "100", "5." → "5"
                onBlur={() =>
                  setPrice((p) =>
                    p === "" || p === "." ? "" : String(Number(p)),
                  )
                }
                placeholder="0.00"
                aria-invalid={!!errors.price}
              />
            </div>
            {errors.price && (
              <span className="addon__error">{errors.price}</span>
            )}
          </div>

          <div className="addon__note">
            <Info size={16} />
            This is the default price. You can set a different price when you
            attach it to a specific product.
          </div>
        </section>

        {/* FEATURES */}
        <section className="addon__section">
          <h2 className="addon__section-title">
            Features <span className="addon__optional">(optional)</span>
          </h2>
          <p className="addon__section-hint">
            Short points shown as a checklist. Press Enter to add the next one.
          </p>

          <div className="addon__feature-list">
            {features.map((feature, index) => (
              <div className="addon__feature-row" key={index}>
                <span className="addon__feature-dot">
                  <Check size={12} />
                </span>
                <input
                  ref={(el) => {
                    featureRefs.current[index] = el;
                  }}
                  type="text"
                  value={feature}
                  onChange={(e) => updateFeature(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeature(index);
                    }
                  }}
                  placeholder={
                    index === 0
                      ? "e.g. Each item packed in a clear poly bag"
                      : "Another feature"
                  }
                  aria-label={`Feature ${index + 1}`}
                />
                <button
                  type="button"
                  className="addon__icon-btn addon__icon-btn--danger"
                  onClick={() => removeFeature(index)}
                  aria-label={`Remove feature ${index + 1}`}
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="addon__btn-outline addon__btn-sm"
            onClick={() => addFeature()}
          >
            <Plus size={15} />
            Add feature
          </button>
        </section>

        {/* IMAGE */}
        <section className="addon__section">
          <h2 className="addon__section-title">
            Image <span className="addon__optional">(optional)</span>
          </h2>
          <p className="addon__section-hint">
            Cropped to 16:9 so every add-on looks the same.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            hidden
            onChange={(e) => {
              handleFileSelected(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {previewUrl ? (
            <div className="addon__image">
              <img src={previewUrl} alt={name || "Add-on"} />

              <div className="addon__image-actions">
                <button type="button" onClick={() => setLightboxSrc(previewUrl)}>
                  <Eye size={14} />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw size={14} />
                  Replace
                </button>
                <button
                  type="button"
                  className="addon__image-remove"
                  onClick={removeImage}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`addon__dropzone ${
                dragOver ? "addon__dropzone--active" : ""
              } ${errors.image ? "addon__input--error" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileSelected(e.dataTransfer.files?.[0]);
              }}
            >
              <span className="addon__dropzone-icon">
                <ImagePlus size={22} />
              </span>
              <strong>Drop an image here, or click to upload</strong>
              <span>PNG, JPG or WEBP · up to 5 MB</span>
            </button>
          )}

          {errors.image && <span className="addon__error">{errors.image}</span>}
        </section>

        {/* ACTIONS */}
        <div className="addon__form-actions">
          <button
            type="button"
            className="addon__btn-outline"
            onClick={() => navigate("/add-ons")}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="addon__btn-primary" disabled={saving}>
            <Check size={16} />
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create add-on"}
          </button>
        </div>
      </form>

      {/* CROP MODAL */}
      {rawImageSrc && (
        <div
          className="addon__overlay"
          onClick={() => !cropSaving && closeCropModal()}
        >
          <div
            className="addon__modal addon__modal--crop"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="addon__modal-close"
              onClick={closeCropModal}
              disabled={cropSaving}
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <h2>Crop image</h2>
            <p className="addon__modal-subtitle">
              Drag the box to choose what shows. It's fixed to 16:9.
            </p>

            <div className="addon__crop-area">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT_RATIO}
                keepSelection
                ruleOfThirds
                minWidth={fixedCropSize?.width}
                maxWidth={fixedCropSize?.width}
                minHeight={fixedCropSize?.height}
                maxHeight={fixedCropSize?.height}
              >
                <img
                  ref={imgRef}
                  src={rawImageSrc}
                  alt="Crop source"
                  onLoad={onCropImageLoad}
                />
              </ReactCrop>
            </div>

            <div className="addon__modal-actions">
              <button
                className="addon__btn-outline"
                onClick={closeCropModal}
                disabled={cropSaving}
              >
                Cancel
              </button>
              <button
                className="addon__btn-primary"
                onClick={handleCropConfirm}
                disabled={cropSaving || !completedCrop?.width}
              >
                {cropSaving ? "Saving…" : "Crop & save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxSrc && (
        <div className="addon__lightbox" onClick={() => setLightboxSrc(null)}>
          <button
            className="addon__lightbox-close"
            onClick={() => setLightboxSrc(null)}
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxSrc}
            alt="Add-on"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default AddOnForm;