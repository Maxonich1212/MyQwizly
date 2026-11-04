import {
  Activity, Dumbbell, Bike, Footprints, HeartPulse, Droplets, Apple, Salad, Coffee, CupSoda, Moon, Sun, Sunrise, BedDouble,
  BookOpen, GraduationCap, Brain, Code, Laptop, Languages, PenLine, Lightbulb, Target, Timer, Music, Guitar, Camera, Palette,
  Leaf, Flower2, Dog, Wallet, PiggyBank, ShoppingCart, Home, Sparkles, Smile, MessageCircle, Phone, Users, Briefcase, Plane,
  Cigarette, Wine, Smartphone, Gamepad2, Pill, Flame, Star, Zap, Mountain, Waves, Bath, Shirt,
} from 'lucide-react'

// Набор иконок для привычек: ключ хранится в базе, компонент берётся отсюда
export const HABIT_ICONS = {
  activity: Activity, dumbbell: Dumbbell, bike: Bike, steps: Footprints, heart: HeartPulse, water: Droplets, apple: Apple,
  salad: Salad, coffee: Coffee, soda: CupSoda, moon: Moon, sun: Sun, sunrise: Sunrise, bed: BedDouble, book: BookOpen,
  study: GraduationCap, brain: Brain, code: Code, laptop: Laptop, lang: Languages, write: PenLine, idea: Lightbulb,
  target: Target, timer: Timer, music: Music, guitar: Guitar, camera: Camera, palette: Palette, leaf: Leaf, flower: Flower2,
  dog: Dog, wallet: Wallet, piggy: PiggyBank, cart: ShoppingCart, home: Home, sparkles: Sparkles, smile: Smile,
  chat: MessageCircle, phone: Phone, people: Users, work: Briefcase, plane: Plane, smoke: Cigarette, wine: Wine,
  screen: Smartphone, game: Gamepad2, pill: Pill, flame: Flame, star: Star, zap: Zap, mountain: Mountain, waves: Waves,
  bath: Bath, shirt: Shirt,
}

export default function HabitIcon({ name, size = 24, strokeWidth = 2 }) {
  const C = HABIT_ICONS[name] || Activity
  return <C size={size} strokeWidth={strokeWidth} />
}
