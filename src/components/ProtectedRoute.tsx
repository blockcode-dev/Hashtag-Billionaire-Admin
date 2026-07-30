/** @format */

import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

interface Props {
	children: React.ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
	const location = useLocation();

	const [loading, setLoading] = useState(true);
	const [authenticated, setAuthenticated] = useState(false);

	useEffect(() => {
		const token = localStorage.getItem("token");

		if (token && token !== "undefined" && token !== "null") {
			setAuthenticated(true);
		}

		setLoading(false);
	}, []);

	// prevent redirect flicker
	if (loading) {
		return null;
	}

	// redirect ONLY if no token
	if (!authenticated) {
		return (
			<Navigate
				to="/"
				replace
				state={{ from: location }}
			/>
		);
	}

	return <>{children}</>;
};

export default ProtectedRoute;