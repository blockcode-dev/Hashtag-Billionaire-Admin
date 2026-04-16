/** @format */

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Search,
	Eye,
	UserX,
	UserCheck,
	RotateCcw,
	CalendarIcon,
	Mail,
	FileText,
	CheckCircle,
	Clock,
	Users as UsersIcon,
	Plus,
	BookOpen,
	Coins,
	TrendingUp,
	Shield,
	ChevronRight,
	Loader2,
	Zap,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
	AddUserCreditsAPI,
	GetAllUsersAPI,
	GetUserDetailsAPI,
	GetUserStatsAPI,
	UpdateUserStatusAPI,
} from "@/services/Api/UserApi";
import "./Users.scss";

const Users = () => {
	const [users, setUsers] = useState<any[]>([]);
	const [stats, setStats] = useState<any>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [manuscriptFilter, setManuscriptFilter] = useState("all");
	const [dateFilter, setDateFilter] = useState("all");
	const [selectedUser, setSelectedUser] = useState<any>(null);
	const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
	const [creditAmount, setCreditAmount] = useState("");
	const [creditLoading, setCreditLoading] = useState(false);
	const [togglingId, setTogglingId] = useState<number | null>(null);
	const { toast } = useToast();

	useEffect(() => {
		loadUsers();
		loadStats();
	}, []);

	const loadUsers = async () => {
		try {
			const res = await GetAllUsersAPI();
			setUsers(res.data.data || []);
		} catch {
			toast({ title: "Failed to load users", variant: "destructive" });
		}
	};

	const loadStats = async () => {
		try {
			const res = await GetUserStatsAPI();
			setStats(res.data.data);
		} catch {
			toast({ title: "Failed to load stats", variant: "destructive" });
		}
	};

	const handleToggleStatus = async (user: any) => {
		const backendStatus = user.status === "ACCEPTED" ? "deactive" : "active";
		setTogglingId(user.id);
		try {
			await UpdateUserStatusAPI({ userId: user.id, status: backendStatus });
			toast({
				title: `User ${backendStatus === "active" ? "Activated" : "Deactivated"}`,
			});
			loadUsers();
			loadStats();
		} catch {
			toast({ title: "Failed to update status", variant: "destructive" });
		} finally {
			setTogglingId(null);
		}
	};

	const mapStatus = (status: string) =>
		status === "ACCEPTED" ? "active" : "inactive";

	const filteredUsers = users.filter((user) => {
		const name = user.user_profile?.name || "";
		const email = user.email || "";
		const manuscripts = user.manuscript_count || 0;
		const accountStatus = mapStatus(user.status);
		const joinDate = user.created_at?.slice(0, 4);
		const matchesSearch =
			name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			email.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || accountStatus === statusFilter;
		const matchesManuscripts =
			manuscriptFilter === "all" ||
			(manuscriptFilter === "1-3" && manuscripts >= 1 && manuscripts <= 3) ||
			(manuscriptFilter === "4-6" && manuscripts >= 4 && manuscripts <= 6) ||
			(manuscriptFilter === "7+" && manuscripts >= 7);
		const matchesDate = dateFilter === "all" || joinDate === dateFilter;
		return matchesSearch && matchesStatus && matchesManuscripts && matchesDate;
	});

	const handleViewProfile = async (userId: number) => {
		try {
			const res = await GetUserDetailsAPI(userId);
			setSelectedUser(res.data.data);
			setIsProfileModalOpen(true);
		} catch {
			toast({ title: "Failed to load user profile", variant: "destructive" });
		}
	};

	const handleAddCredits = async () => {
		if (!selectedUser?.id || !creditAmount) {
			toast({ title: "Enter valid credit amount", variant: "destructive" });
			return;
		}
		try {
			setCreditLoading(true);
			await AddUserCreditsAPI({
				user_id: selectedUser.id,
				credit: Number(creditAmount),
			});
			toast({ title: "Credits added successfully 💰" });
			setCreditAmount("");
			const res = await GetUserDetailsAPI(selectedUser.id);
			setSelectedUser(res.data.data);
		} catch {
			toast({ title: "Failed to add credits", variant: "destructive" });
		} finally {
			setCreditLoading(false);
		}
	};

	const getInitials = (name: string) =>
		name
			?.split(" ")
			.map((n: string) => n[0])
			.join("")
			.slice(0, 2) || "??";

	const getProjectStatusLabel = (status: string) => {
		if (status === "completed")
			return { label: "Completed", cls: "status-complete" };
		if (status === "in-editing")
			return { label: "In Editing", cls: "status-editing" };
		return { label: "Draft", cls: "status-draft" };
	};

	return (
		<div className="users-root">
			{/* ── PAGE HEADER ── */}
			<div className="users-header">
				<div>
					<h1 className="users-title">Users</h1>
					<p className="users-sub">Manage accounts, credits & manuscripts</p>
				</div>
				<div className="users-total-pill">
					<UsersIcon size={14} />
					{users.length} total
				</div>
			</div>

			{/* ── STATS STRIP ── */}
			<div className="stats-strip">
				<div className="stat-card">
					<div className="stat-icon stat-icon--blue">
						<UsersIcon size={16} />
					</div>
					<div>
						<div className="stat-value">{stats?.totalUsers || 0}</div>
						<div className="stat-label">Total Users</div>
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-icon stat-icon--green">
						<CheckCircle size={16} />
					</div>
					<div>
						<div className="stat-value stat-value--green">
							{stats?.activeUsers || 0}
						</div>
						<div className="stat-label">Active</div>
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-icon stat-icon--gray">
						<Clock size={16} />
					</div>
					<div>
						<div className="stat-value">{stats?.inactiveUsers || 0}</div>
						<div className="stat-label">Inactive</div>
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-icon stat-icon--amber">
						<FileText size={16} />
					</div>
					<div>
						<div className="stat-value">{stats?.totalManuscripts || 0}</div>
						<div className="stat-label">Manuscripts</div>
					</div>
				</div>
			</div>

			{/* ── SEARCH + FILTERS ── */}
			<div className="filters-container">
				{/* SEARCH */}
				<div className="search-wrap">
					<Search size={15} className="search-icon" />
					<input
						className="search-input"
						placeholder="Search users by name or email…"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>

				{/* FILTERS */}
				<div className="filters-scroll">
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="filter-select">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="inactive">Inactive</SelectItem>
						</SelectContent>
					</Select>

					<Select value={manuscriptFilter} onValueChange={setManuscriptFilter}>
						<SelectTrigger className="filter-select">
							<SelectValue placeholder="Manuscripts" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Manuscripts</SelectItem>
							<SelectItem value="1-3">1–3</SelectItem>
							<SelectItem value="4-6">4–6</SelectItem>
							<SelectItem value="7+">7+</SelectItem>
						</SelectContent>
					</Select>

					<Select value={dateFilter} onValueChange={setDateFilter}>
						<SelectTrigger className="filter-select">
							<SelectValue placeholder="Year joined" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Years</SelectItem>
							<SelectItem value="2025">2025</SelectItem>
							<SelectItem value="2024">2024</SelectItem>
							<SelectItem value="2023">2023</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* RIGHT SIDE ACTIONS */}
				<div className="filters-actions">
					<button
						className="btn-clear-filters"
						onClick={() => {
							setSearchTerm("");
							setStatusFilter("all");
							setManuscriptFilter("all");
							setDateFilter("all");
						}}
					>
						<RotateCcw size={14} />
						Clear
					</button>

					<div className="filter-count">{filteredUsers.length} results</div>
				</div>
			</div>

			{/* ── TABLE ── */}
			<div className="users-table-wrap">
				<table className="users-table">
					<thead>
						<tr>
							<th>User</th>
							<th>Email</th>
							<th>Manuscripts</th>
							<th>Joined</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{filteredUsers.map((u) => {
							const name = u.user_profile?.name || "N/A";
							const isActive = u.status === "ACCEPTED";
							const isToggling = togglingId === u.id;

							return (
								<tr key={u.id} className="user-row">
									<td>
										<div className="user-cell">
											<Avatar className="user-avatar">
												<AvatarImage src={u.user_attachments?.[0]?.file_uri} />
												<AvatarFallback className="avatar-fallback">
													{getInitials(name)}
												</AvatarFallback>
											</Avatar>
											<span className="user-name-1">{name}</span>
										</div>
									</td>
									<td className="cell-email">{u.email}</td>
									<td>
										<div className="manuscript-cell">
											<BookOpen size={13} />
											<span>{u.manuscript_count || 0}</span>
										</div>
									</td>
									<td className="cell-date">
										{format(new Date(u.created_at), "MMM dd, yyyy")}
									</td>
									<td>
										<span
											className={`status-badge ${isActive ? "badge-active" : "badge-inactive"}`}
										>
											{isActive ? (
												<CheckCircle size={11} />
											) : (
												<Clock size={11} />
											)}
											{isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td>
										<div className="action-buttons">
											<button
												className="btn-view"
												onClick={() => handleViewProfile(u.id)}
											>
												<Eye size={13} />
												View
											</button>
											<button
												className={`btn-toggle ${isActive ? "btn-deactivate" : "btn-activate"}`}
												onClick={() => handleToggleStatus(u)}
												disabled={isToggling}
											>
												{isToggling ? (
													<Loader2 size={13} className="spin" />
												) : isActive ? (
													<UserX size={13} />
												) : (
													<UserCheck size={13} />
												)}
												{isActive ? "Deactivate" : "Activate"}
											</button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>

				{filteredUsers.length === 0 && (
					<div className="empty-state">
						<UsersIcon size={32} />
						<p>No users match your filters</p>
					</div>
				)}
			</div>

			{/* ── USER PROFILE MODAL ── */}
			<Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
				<DialogContent className="user-modal">
					<DialogHeader className="modal-header-hidden">
						<DialogTitle className="sr-only">User Profile</DialogTitle>
					</DialogHeader>

					{selectedUser && (
						<div className="modal-body">
							{/* HERO */}
							<div className="modal-hero">
								<div className="modal-hero-bg" />
								<div className="modal-hero-content">
									<Avatar className="modal-avatar">
										<AvatarImage
											src={selectedUser.user_attachments?.[0]?.file_uri || ""}
										/>
										<AvatarFallback className="modal-avatar-fallback">
											{getInitials(selectedUser.user_profile?.name || "")}
										</AvatarFallback>
									</Avatar>
									<div className="modal-user-info">
										<h2 className="modal-name">
											{selectedUser.user_profile?.name}
										</h2>
										<div className="modal-email">
											<Mail size={13} />
											{selectedUser.email}
										</div>
										<div className="modal-meta-row">
											<span className="modal-meta-item">
												<CalendarIcon size={12} />
												Joined{" "}
												{format(new Date(selectedUser.created_at), "MMM yyyy")}
											</span>
											<span
												className={`modal-status ${selectedUser.status === "ACCEPTED" ? "modal-status--active" : "modal-status--inactive"}`}
											>
												{selectedUser.status === "ACCEPTED"
													? "Active"
													: "Inactive"}
											</span>
										</div>
									</div>
								</div>

								{/* QUICK STATS */}
								<div className="modal-quick-stats">
									<div className="modal-stat">
										<div className="modal-stat-value">
											{selectedUser.total_credit ?? 0}
										</div>
										<div className="modal-stat-label">Credits</div>
									</div>
									<div className="modal-stat-divider" />
									<div className="modal-stat">
										<div className="modal-stat-value">
											{selectedUser.user_books?.length || 0}
										</div>
										<div className="modal-stat-label">Projects</div>
									</div>
									<div className="modal-stat-divider" />
									<div className="modal-stat">
										<div className="modal-stat-value">
											{selectedUser.manuscript_count || 0}
										</div>
										<div className="modal-stat-label">Manuscripts</div>
									</div>
								</div>
							</div>

							{/* ADD CREDITS */}
							<div className="credits-section">
								<div className="section-label">
									<Coins size={14} />
									Add Credits
								</div>

								<div className="quick-credits">
									{[10, 25, 50, 100].map((amt) => (
										<button
											key={amt}
											className={`quick-credit-btn ${creditAmount === String(amt) ? "selected" : ""}`}
											onClick={() => setCreditAmount(String(amt))}
										>
											+{amt}
										</button>
									))}
								</div>

								<div className="credit-input-row">
									<div className="credit-input-wrap">
										<Zap size={14} className="credit-input-icon" />
										<input
											type="number"
											className="credit-input"
											placeholder="Custom amount"
											value={creditAmount}
											onChange={(e) => setCreditAmount(e.target.value)}
										/>
									</div>
									<button
										className="btn-add-credits"
										onClick={handleAddCredits}
										disabled={creditLoading}
									>
										{creditLoading ? (
											<Loader2 size={14} className="spin" />
										) : (
											<Plus size={14} />
										)}
										{creditLoading ? "Adding…" : "Add Credits"}
									</button>
								</div>
							</div>

							{/* PROJECTS */}
							{selectedUser.user_books?.length > 0 && (
								<div className="projects-section">
									<div className="section-label">
										<BookOpen size={14} />
										Projects ({selectedUser.user_books.length})
									</div>

									<div className="project-list">
										{selectedUser.user_books.map((book: any) => {
											const { label, cls } = getProjectStatusLabel(book.status);
											return (
												<div key={book.id} className="project-card">
													<div className="project-card-left">
														<div className="project-book-icon">
															<FileText size={14} />
														</div>
														<div>
															<div className="project-title">{book.title}</div>
															<div className="project-genre">
																{book.book_genre?.title || "No genre"}
															</div>
														</div>
													</div>
													<span className={`project-status ${cls}`}>
														{label}
													</span>
												</div>
											);
										})}
									</div>
								</div>
							)}

							{/* ACCOUNT ACTIONS */}
							<div className="modal-actions">
								<button
									className="modal-action-btn modal-action-deactivate"
									onClick={() => {
										handleToggleStatus(selectedUser);
										setIsProfileModalOpen(false);
									}}
								>
									<UserX size={14} />
									{selectedUser.status === "ACCEPTED"
										? "Deactivate Account"
										: "Activate Account"}
								</button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default Users;
