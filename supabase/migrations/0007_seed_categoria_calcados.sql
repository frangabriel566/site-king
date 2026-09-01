-- King Store — 0007_seed_categoria_calcados.sql
-- Complementary seed data: the original seed only covered Moletons,
-- Camisetas, Calças and Acessórios — footwear has nowhere to go.

insert into public.categories (id, name, slug, position, active) values
  ('11111111-1111-1111-1111-111111111105', 'Calçados', 'calcados', 5, true)
on conflict (id) do nothing;
