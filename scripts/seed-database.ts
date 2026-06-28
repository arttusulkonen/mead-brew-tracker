import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';

// Загружаем переменные окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Используем Service Role ключ для обхода RLS при заливке базы
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});

const DATA_DIR = path.resolve(__dirname, '../data');

// Вспомогательная функция для конвертации Фаренгейтов в Цельсии
const fToC = (f: number) => Number(((f - 32) * 5 / 9).toFixed(1));

async function seedStyles() {
  console.log('⏳ Seeding BJCP Styles...');
  const stylesPath = path.join(DATA_DIR, 'DefaultContent002-BJCP_2021_Styles.json');
  
  if (!fs.existsSync(stylesPath)) {
    console.log('❌ Styles file not found. Skipping.');
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(stylesPath, 'utf8'));
  const styles = rawData.beerjson?.styles || [];

  const formattedStyles = styles.map((s: any) => ({
    style_id: s.style_id || crypto.randomUUID(),
    name: s.name,
    category: s.category,
    beverage_type: s.category.toLowerCase().includes('mead') ? 'Mead' : s.category.toLowerCase().includes('cider') ? 'Cider' : 'Beer',
    og_min: s.original_gravity?.minimum?.value || null,
    og_max: s.original_gravity?.maximum?.value || null,
    fg_min: s.final_gravity?.minimum?.value || null,
    fg_max: s.final_gravity?.maximum?.value || null,
    abv_min: s.alcohol_by_volume?.minimum?.value || null,
    abv_max: s.alcohol_by_volume?.maximum?.value || null,
    ibu_min: s.international_bitterness_units?.minimum?.value || null,
    ibu_max: s.international_bitterness_units?.maximum?.value || null,
    ebc_min: s.color?.minimum?.value ? Number((s.color.minimum.value * 1.97).toFixed(1)) : null, // SRM to EBC
    ebc_max: s.color?.maximum?.value ? Number((s.color.maximum.value * 1.97).toFixed(1)) : null,
    notes: s.overall_impression || ''
  }));

  const { error } = await supabase.from('styles').upsert(formattedStyles, { onConflict: 'style_id' });
  if (error) console.error('Error seeding styles:', error);
  else console.log(`✅ Successfully seeded ${formattedStyles.length} styles.`);
}

async function seedHops() {
  console.log('⏳ Seeding Hops...');
  const hopsPath = path.join(DATA_DIR, 'DefaultContent003-Ingredients-Hops-Yeasts.json');
  
  if (!fs.existsSync(hopsPath)) return;

  const rawData = JSON.parse(fs.readFileSync(hopsPath, 'utf8'));
  const hops = rawData.beerjson?.hop_varieties || [];

  const formattedHops = hops.map((h: any) => ({
    is_global: true,
    name: h.name,
    category: 'Hops',
    form: 'Pellet', // Дефолт, пивовар сможет изменить на складе
    alpha_acid_pct: h.alpha_acid?.value || 5.0,
    origin: h.origin || '',
    notes: h.notes || ''
  }));

  const { error } = await supabase.from('ingredients').insert(formattedHops);
  if (error) console.error('Error seeding hops:', error);
  else console.log(`✅ Successfully seeded ${formattedHops.length} hops.`);
}

async function seedYeasts() {
  console.log('⏳ Seeding Yeasts...');
  const yeastsPath = path.join(DATA_DIR, 'DefaultContent004-MoreYeasts.json');
  
  if (!fs.existsSync(yeastsPath)) return;

  const rawData = JSON.parse(fs.readFileSync(yeastsPath, 'utf8'));
  const cultures = rawData.beerjson?.cultures || [];

  const formattedYeasts = cultures.map((y: any) => ({
    is_global: true,
    name: y.name,
    category: 'Yeast',
    form: y.form === 'liquid' ? 'Liquid' : 'Dry',
    producer: y.producer || '',
    alcohol_tolerance_pct: y.alcohol_tolerance?.value || 12,
    temp_min_c: y.temperature_range?.minimum?.unit === 'F' ? fToC(y.temperature_range.minimum.value) : y.temperature_range?.minimum?.value || 15,
    temp_max_c: y.temperature_range?.maximum?.unit === 'F' ? fToC(y.temperature_range.maximum.value) : y.temperature_range?.maximum?.value || 25,
    attenuation_pct: y.attenuation_range?.maximum?.value || 75,
    notes: `Best for: ${y.best_for || 'Various'}. ${y.notes || ''}`
  }));

  const { error } = await supabase.from('ingredients').insert(formattedYeasts);
  if (error) console.error('Error seeding yeasts:', error);
  else console.log(`✅ Successfully seeded ${formattedYeasts.length} yeasts.`);
}

async function run() {
  await seedStyles();
  await seedHops();
  await seedYeasts();
  console.log('🚀 Database Seeding Complete!');
}

run();