import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// The shop's gallery photos (client decision Q56). The shop lists the active ones
// through GET gallery; the admin token is attached by the axios interceptor.

export interface GalleryPhoto {
  id: number;
  image_url: string;
  caption: string | null;
  // Lowest first; photos with the same number show newest first.
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Every photo, hidden ones included, in the shop's order.
export const GetGalleryAdminAPI = async () => {
  return axios.get<{ data: GalleryPhoto[] }>(`${API_BASE_URL}gallery/admin`);
};

// Multipart: one image in `images` (JPG, PNG, WebP, AVIF or GIF, up to 20 MB),
// plus optional `caption` (255 characters), `sort_order` and `is_active`.
export const CreateGalleryPhotoAPI = async (body: FormData) => {
  return axios.post<{ data: GalleryPhoto }>(`${API_BASE_URL}gallery`, body);
};

// Any of the create fields; a new `images` file replaces the photo.
export const UpdateGalleryPhotoAPI = async (
  id: number,
  body:
    | FormData
    | { caption?: string; sort_order?: number; is_active?: boolean },
) => {
  return axios.put<{ data: GalleryPhoto }>(`${API_BASE_URL}gallery/${id}`, body);
};

export const DeleteGalleryPhotoAPI = async (id: number) => {
  return axios.delete(`${API_BASE_URL}gallery/${id}`);
};
