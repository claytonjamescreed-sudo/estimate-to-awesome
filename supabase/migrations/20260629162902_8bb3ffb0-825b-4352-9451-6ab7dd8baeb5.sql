
CREATE TABLE public.product_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  tagline TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_library TO authenticated;
GRANT ALL ON public.product_library TO service_role;

ALTER TABLE public.product_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read products"
  ON public.product_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert products"
  ON public.product_library FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products"
  ON public.product_library FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products"
  ON public.product_library FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_product_library_updated_at
  BEFORE UPDATE ON public.product_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.product_library (name, category, tagline, image_url, link, highlights) VALUES
  ('Logitech Rally Bar', 'Video Bar',
   'All-in-one premium video bar for medium rooms',
   'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_2.0/d_transparent.gif/content/dam/logitech/en/video-collaboration/rally-bar/gallery/rally-bar-graphite-gallery-1.png',
   'https://www.logitech.com/en-ca/products/video-conferencing/conference-cameras/rally-bar.html',
   '["AI-driven RightSight 2 framing","Beamforming mic array, 4.5 m pickup","Runs Zoom/Teams natively, no PC needed","Modular expansion mics & speakers"]'::jsonb),
  ('Crestron Flex UC-MX70-T', 'Room System',
   'Microsoft Teams Rooms with Crestron control',
   'https://www.crestron.com/getmedia/UC-MX70-T.png',
   'https://www.crestron.com/Products/Workspace-Solutions/Unified-Communications/Microsoft-Teams-Rooms',
   '["Native Microsoft Teams Rooms experience","10.1\" touch console with scheduling","Auto-framing intelligent camera","Enterprise managed via XiO Cloud"]'::jsonb),
  ('Q-SYS Core Nano', 'Audio DSP',
   'Compact AV&C processor for software-based rooms',
   'https://www.qsys.com/contentassets/qsys-core-nano.png',
   'https://www.qsys.com/products-solutions/q-sys/processing/cores/core-nano/',
   '["Audio, video & control in one platform","8 x 8 software channel capacity","Plugin ecosystem (Shure, Sennheiser, etc.)","Q-SYS Reflect remote monitoring"]'::jsonb),
  ('Shure MXA920 Ceiling Array', 'Microphone',
   'Premium ceiling array mic with IntelliMix DSP',
   'https://pubs.shure.com/binary/d4cabea1e7a4b6fa.png',
   'https://www.shure.com/en-US/microphones/mxa920',
   '["Steerable Coverage™, no aiming required","Automatic coverage of 30 x 30 ft rooms","IntelliMix DSP onboard","White, black, aluminum finishes"]'::jsonb);
