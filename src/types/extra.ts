export interface StaffDayStat {
  id: string;
  staff_id: string;
  business_date: string;
  total_sale: number;
  products_sold: number;
  transactions: number;
}

export interface RealtimeProduct {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  selling_price: number | null;
  category: string | null;
  stock: number;
  status: string;
  updated_at: string;
}