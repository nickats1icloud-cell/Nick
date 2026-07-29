-- Storage bucket for article content images
INSERT INTO storage.buckets (id, name, public) VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for article-images bucket
CREATE POLICY "Authenticated users can upload article images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'article-images');

CREATE POLICY "Article images are public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'article-images');

CREATE POLICY "Users can delete own article images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'article-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Shop products table (admin managed)
CREATE TABLE public.shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'Γενικά',
  badge TEXT,
  sizes TEXT[], -- e.g. {S,M,L,XL,XXL}
  stock INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are public" ON public.shop_products
FOR SELECT USING (true);

CREATE POLICY "Admins can manage products" ON public.shop_products
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Shop orders table
CREATE TABLE public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC NOT NULL DEFAULT 0,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.shop_orders
FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create orders" ON public.shop_orders
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update orders" ON public.shop_orders
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Shop order items
CREATE TABLE public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  size TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items" ON public.shop_order_items
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.shop_orders WHERE shop_orders.id = shop_order_items.order_id 
  AND (shop_orders.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Users can create order items" ON public.shop_order_items
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.shop_orders WHERE shop_orders.id = shop_order_items.order_id 
  AND shop_orders.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_shop_orders_updated_at BEFORE UPDATE ON public.shop_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_products_updated_at BEFORE UPDATE ON public.shop_products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();