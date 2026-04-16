/** @format */

import { useEffect, useState } from "react";
import { GetAllProductsAPI } from "@/services/Api/ProductApi";
import { Input } from "@/components/ui/input";
import { Search, Eye, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./Products.scss";

const ProductsPage = () => {
	const [variants, setVariants] = useState<any[]>([]);
	const [search, setSearch] = useState("");
	const navigate = useNavigate();

	useEffect(() => {
		load();
	}, []);

	const load = async () => {
		const res = await GetAllProductsAPI();
		setVariants(res.data.data || []);
	};

	const filtered = variants.filter((v) => {
		const term = search.toLowerCase();

		return (
			v.product?.name?.toLowerCase().includes(term) ||
			v.sku?.toLowerCase().includes(term) ||
			v.color?.toLowerCase().includes(term) ||
			v.size?.toLowerCase().includes(term) ||
			v.product?.external_style_name?.toLowerCase().includes(term)
		);
	});

	const handleImport = () => {
		const csv = convertToCSV(variants);
		downloadCSV(csv);
	};

	const convertToCSV = (data: any[]) => {
		const headers = [
			"Type",
			"SKU",
			"Name",
			"Published",
			"Is featured?",
			"Visibility in catalog",
			"Description",
			"Tax status",
			"Tax class",
			"In stock?",
			"Stock",
		];

		const grouped: any = {};

		// group variants by product
		data.forEach((v) => {
			const pid = v.product_id;
			if (!grouped[pid]) {
				grouped[pid] = {
					product: v.product,
					variants: [],
				};
			}
			grouped[pid].variants.push(v);
		});

		const rows: any[] = [];

		Object.values(grouped).forEach((p: any) => {
			// ✅ PARENT (variable)
			rows.push([
				"variable",
				p.product.external_style_id || "",
				p.product.name,
				1,
				0,
				"visible",
				stripHtml(p.product.description),
				"taxable",
				"",
				1,
				"",
			]);

			// ✅ VARIANTS
			p.variants.forEach((v: any) => {
				rows.push([
					"variation",
					v.sku,
					p.product.name,
					1,
					0,
					"visible",
					stripHtml(p.product.description),
					"taxable",
					"parent",
					1,
					v.stock,
				]);
			});
		});

		return [headers, ...rows]
			.map((row) => row.map((i) => `"${i ?? ""}"`).join(","))
			.join("\n");
	};

	const stripHtml = (html: string) => {
		const div = document.createElement("div");
		div.innerHTML = html || "";
		return div.innerText;
	};

	const downloadCSV = (csv: string) => {
		const blob = new Blob([csv], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = "variants.csv";
		a.click();
	};

	return (
		<div className="products-root">
			{/* HEADER */}
			<div className="products-header">
				<div className="left">
					<h1>Product</h1>
					<p>{variants.length} total variants</p>
				</div>

				<div className="right">
					<div className="action-bar">
						<div className="search-box">
							<Search size={14} />
							<input
								placeholder="Search name, SKU, style..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>

						<button className="btn-export" onClick={handleImport}>
							<Upload size={14} />
							Export
						</button>
					</div>
				</div>
			</div>

			{/* TABLE */}
			<div className="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Product</th>
							<th>Style Name</th>

							<th>Color</th>
							<th>Size</th>
							<th>Price</th>
							<th>Stock</th>
							<th>Action</th>
						</tr>
					</thead>

					<tbody>
						{filtered.map((v) => (
							<tr key={v.id}>
								<td>
									<div className="product-cell">
										<img
											src={
												v.images?.[0]?.file_uri ||
												v.product?.attachments?.[0]?.file_uri ||
												"/placeholder.png"
											}
											alt="product"
										/>

										<div className="info">
											<p className="name">{v.product?.name}</p>
											<span className="sku">{v.sku}</span>
										</div>
									</div>
								</td>
								<td>{v.product?.external_style_name}</td>
								<td>{v.color}</td>
								<td>{v.size}</td>
								<td>$ {v.price}</td>
								<td>{v.stock}</td>
								<td>
									<button
										onClick={() =>
											navigate(`/products/${v.id}`, {
												state: { variant: v, all: variants },
											})
										}
										className="btn-view"
									>
										<Eye size={14} />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{filtered.length === 0 && <p>No data</p>}
			</div>
		</div>
	);
};

export default ProductsPage;
