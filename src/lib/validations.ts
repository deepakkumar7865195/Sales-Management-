import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  cost_price: z.coerce.number().min(0, "Cost price cannot be negative"),
  selling_price: z.coerce
    .number()
    .min(0, "Selling price cannot be negative")
    .nullable()
    .optional(),
  category: z.string().optional().nullable(),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  image_url: z.string().optional().nullable(),
});

export type ProductValues = z.infer<typeof productSchema>;

export const saleItemInputSchema = z.object({
  product_id: z.string().min(1, "Select a product"),
  quantity: z.coerce.number().int().min(1, "Please enter quantity"),
  selling_price: z.coerce
    .number()
    .min(0.01, "Please enter a valid sale amount"),
});

export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const saleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, "Add at least one product"),
});

export type SaleValues = z.infer<typeof saleSchema>;

export const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain letters")
    .regex(/[0-9]/, "Password must contain numbers"),
});

export type StaffValues = z.infer<typeof staffSchema>;

export const settingsSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  business_phone: z.string().optional().nullable(),
  business_address: z.string().optional().nullable(),
  currency: z.string().default("INR"),
  staff_can_view_profit: z.boolean().default(false),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
});

export type SettingsValues = z.infer<typeof settingsSchema>;