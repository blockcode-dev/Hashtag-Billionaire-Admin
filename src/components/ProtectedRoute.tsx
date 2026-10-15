/** @format */

import { Navigate, useLocation } from "react-router";
import { getToken, useSession } from "@/lib/session";
import UnauthorizedPage from "@/pages/UnauthorizedPage";

interface Props {
	children: React.ReactNode;
	// Screens backed by Super Admin only endpoints (admin accounts).
	superAdminOnly?: boolean;
}

const ProtectedRoute = ({ children, superAdminOnly = false }: Props) => {
	const location = useLocation();
	const { isSuperAdmin } = useSession();

	if (!getToken()) {
		return <Navigate to="/" replace state={{ from: location }} />;
	}

	if (superAdminOnly && !isSuperAdmin) {
		return <UnauthorizedPage />;
	}

	return <>{children}</>;
};

export default ProtectedRoute;
