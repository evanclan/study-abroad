-- Seed reference data for the quote engine.

insert into countries (code, name_ja, name_en, currency_code) values
  ('AU', 'オーストラリア', 'Australia', 'AUD'),
  ('US', 'アメリカ', 'United States', 'USD'),
  ('GB', 'イギリス', 'United Kingdom', 'GBP'),
  ('CA', 'カナダ', 'Canada', 'CAD'),
  ('NZ', 'ニュージーランド', 'New Zealand', 'NZD'),
  ('IE', 'アイルランド', 'Ireland', 'EUR'),
  ('MT', 'マルタ', 'Malta', 'EUR'),
  ('PH', 'フィリピン', 'Philippines', 'PHP'),
  ('JP', '日本', 'Japan', 'JPY')
on conflict (code) do update set
  name_ja = excluded.name_ja,
  name_en = excluded.name_en,
  currency_code = excluded.currency_code;

insert into course_types (slug, name_ja, name_en) values
  ('summer_camp', 'サマーキャンプ', 'Summer Camp'),
  ('highschool', '高校留学', 'High School'),
  ('language_school', '語学学校', 'Language School'),
  ('university', '大学・大学院', 'University'),
  ('vocational', '専門学校', 'Vocational')
on conflict (slug) do update set
  name_ja = excluded.name_ja,
  name_en = excluded.name_en;

-- A handful of well-known partner schools to seed the catalog. The engine will
-- self-heal and add more schools as live_search results come back.
insert into schools (country_code, name, source_url) values
  ('AU', 'Sydney English Academy', 'https://www.sydneyenglishacademy.com.au/'),
  ('AU', 'Kaplan International Brisbane', 'https://www.kaplaninternational.com/destinations/australia/brisbane'),
  ('US', 'Kaplan International Los Angeles', 'https://www.kaplaninternational.com/destinations/united-states/los-angeles'),
  ('GB', 'EC London', 'https://www.ecenglish.com/en/school-locations/england/learn-english-in-london'),
  ('CA', 'ILSC Vancouver', 'https://www.ilsc.com/canada/vancouver/'),
  ('NZ', 'Languages International Auckland', 'https://www.languages.ac.nz/'),
  ('PH', 'CIA Cebu', 'https://cebu-cia.com/')
on conflict (country_code, name) do nothing;
