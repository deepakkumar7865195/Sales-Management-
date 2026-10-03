export type UserRole = "admin" | "staff";

export type ProductStatus = "active" | "inactive";

export type AuditAction =
  | "product_added"
  | "product_edited"
  | "cost_price_changed"
  | "product_deleted"
  | "sale_created"
  | "sale_modified"
  | "day_closed"
  | "staff_created"
  | "staff_disabled"
  | "staff_enabled"
  | "settings_updated";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "disabled";
  created_at: string;
  is_super_admin?: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  cost_price: number;
  selling_price: number | null;
  category: string | null;
  stock: number | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductWithoutCost
  extends Omit<Product, "cost_price"> {
  cost_price?: never;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  selling_price: number;
  cost_price: number;
  total_sale: number;
  total_cost: number;
  profit: number;
}

export interface Sale {
  id: string;
  transaction_id: string;
  staff_id: string;
  staff_name?: string;
  sale_date: string;
  total_sale: number;
  total_cost: number;
  total_profit: number;
  item_count: number;
  status: "open" | "closed";
  created_at: string;
  items?: SaleItem[];
}

export interface DailyClosing {
  id: string;
  business_date: string;
  total_sales: number;
  total_cost: number;
  total_profit: number;
  total_transactions: number;
  products_sold: number;
  closed_by: string;
  closed_at: string;
  status: "closed";
}

export interface AuditEntry {
  id: string;
  user_id: string;
  user_name?: string;
  action: AuditAction;
  details: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  business_name: string;
  business_phone: string;
  business_address: string;
  currency: string;
  staff_can_view_profit: boolean;
  low_stock_threshold: number;
  updated_at: string;
}