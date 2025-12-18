/**
 * 用户画像问卷配置
 * 支持多种分类和问题类型
 * 支持国际化
 */

export interface QuestionOption {
  id: string;
  label: string;
  icon?: string;
}

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'scale' | 'preference';
  question: string;
  description?: string;
  options: QuestionOption[];
}

export interface CategoryQuestions {
  category: string;
  title: string;
  description: string;
  questions: Question[];
}

// 问题图标配置（与语言无关）
const questionIcons: Record<string, Record<string, string>> = {
  entertainment: {
    movie_genre: {
      action: '💥', comedy: '😂', drama: '🎭', scifi: '🚀',
      romance: '💕', horror: '👻', documentary: '📽️', anime: '🎌',
    },
    music_genre: {
      pop: '🎤', rock: '🎸', hiphop: '🎧', electronic: '🎹',
      classical: '🎻', jazz: '🎷', rnb: '🎵', folk: '🪕',
    },
    content_preference: {
      mainstream: '🔥', niche: '💎', classic: '📼', latest: '🆕',
    },
  },
  entertainment_games: {
    game_genre: {
      action: '⚔️', rpg: '🗡️', strategy: '🎲', fps: '🔫',
      adventure: '🗺️', simulation: '🏗️', sports: '⚽', racing: '🏎️',
      horror: '👻', casual: '🧩', mmo: '🌐', indie: '🎨',
    },
    game_platform: {
      pc: '💻', mobile: '📱', ps: '🎮', xbox: '🎮', switch: '🎮', vr: '🥽',
    },
    game_playstyle: {
      single_story: '📖', multiplayer: '👥', coop: '🤝',
      sandbox: '🏜️', competitive: '🏆', casual: '☕',
    },
    game_budget: {
      free: '🆓', low: '💰', medium: '💰💰', high: '💰💰💰', premium: '💎',
    },
  },
  shopping: {
    shopping_categories: {
      electronics: '📱', fashion: '👔', beauty: '💄', home: '🏠',
      books: '📚', sports: '⛷️', food: '🍕', toys: '🧸',
    },
    shopping_style: {
      budget: '💰', quality: '⭐', brand: '🏆', trendy: '🔥', minimalist: '⚪',
    },
  },
  food: {
    cuisine_type: {
      sichuan: '🌶️', cantonese: '🦐', japanese: '🍱', korean: '🍲',
      western: '🥩', hotpot: '🍲', bbq: '🍢', dessert: '🍰',
    },
    dining_scene: {
      family: '👨‍👩‍👧‍👦', date: '❤️', friends: '🎉', business: '💼', solo: '🍜',
    },
  },
  travel: {
    travel_type: {
      nature: '🏔️', city: '🏙️', beach: '🏖️',
      cultural: '🏛️', adventure: '🎿', food: '🍴',
    },
    travel_style: {
      budget: '🎒', comfort: '🏨', luxury: '💎', family: '👨‍👩‍👧',
    },
    travel_duration: {
      weekend: '📅', short: '🗓️', long: '📆', extended: '🌍',
    },
  },
  fitness: {
    fitness_type: {
      gym: '🏋️', running: '🏃', yoga: '🧘', swimming: '🏊',
      cycling: '🚴', dance: '💃', martial: '🥋', team: '⚽',
    },
    fitness_level: {
      beginner: '🌱', intermediate: '🌿', advanced: '🌳', expert: '🏆',
    },
    fitness_goal: {
      weight_loss: '📉', muscle: '💪', health: '❤️', flexibility: '🤸', endurance: '🏃',
    },
    fitness_frequency: {
      rarely: '😴', weekly: '📅', regular: '💪', daily: '🔥',
    },
  },
};

// 问卷结构（与语言无关）
const questionStructure = {
  entertainment: {
    questions: [
      { id: 'movie_genre', type: 'multiple' as const, options: ['action', 'comedy', 'drama', 'scifi', 'romance', 'horror', 'documentary', 'anime'] },
      { id: 'music_genre', type: 'multiple' as const, options: ['pop', 'rock', 'hiphop', 'electronic', 'classical', 'jazz', 'rnb', 'folk'] },
      { id: 'content_preference', type: 'single' as const, options: ['mainstream', 'niche', 'classic', 'latest'] },
    ],
  },
  entertainment_games: {
    questions: [
      { id: 'game_genre', type: 'multiple' as const, options: ['action', 'rpg', 'strategy', 'fps', 'adventure', 'simulation', 'sports', 'racing', 'horror', 'casual', 'mmo', 'indie'] },
      { id: 'game_platform', type: 'multiple' as const, options: ['pc', 'mobile', 'ps', 'xbox', 'switch', 'vr'] },
      { id: 'game_playstyle', type: 'single' as const, options: ['single_story', 'multiplayer', 'coop', 'sandbox', 'competitive', 'casual'] },
      { id: 'game_difficulty', type: 'scale' as const, options: ['1', '2', '3', '4', '5'] },
      { id: 'game_budget', type: 'single' as const, options: ['free', 'low', 'medium', 'high', 'premium'] },
    ],
  },
  shopping: {
    questions: [
      { id: 'shopping_categories', type: 'multiple' as const, options: ['electronics', 'fashion', 'beauty', 'home', 'books', 'sports', 'food', 'toys'] },
      { id: 'shopping_style', type: 'single' as const, options: ['budget', 'quality', 'brand', 'trendy', 'minimalist'] },
      { id: 'price_range', type: 'single' as const, options: ['under_50', '50_200', '200_500', '500_1000', 'over_1000'] },
    ],
  },
  food: {
    questions: [
      { id: 'cuisine_type', type: 'multiple' as const, options: ['sichuan', 'cantonese', 'japanese', 'korean', 'western', 'hotpot', 'bbq', 'dessert'] },
      { id: 'spice_level', type: 'scale' as const, options: ['1', '2', '3', '4', '5'] },
      { id: 'dining_scene', type: 'multiple' as const, options: ['family', 'date', 'friends', 'business', 'solo'] },
    ],
  },
  travel: {
    questions: [
      { id: 'travel_type', type: 'multiple' as const, options: ['nature', 'city', 'beach', 'cultural', 'adventure', 'food'] },
      { id: 'travel_style', type: 'single' as const, options: ['budget', 'comfort', 'luxury', 'family'] },
      { id: 'travel_duration', type: 'single' as const, options: ['weekend', 'short', 'long', 'extended'] },
    ],
  },
  fitness: {
    questions: [
      { id: 'fitness_type', type: 'multiple' as const, options: ['gym', 'running', 'yoga', 'swimming', 'cycling', 'dance', 'martial', 'team'] },
      { id: 'fitness_level', type: 'single' as const, options: ['beginner', 'intermediate', 'advanced', 'expert'] },
      { id: 'fitness_goal', type: 'multiple' as const, options: ['weight_loss', 'muscle', 'health', 'flexibility', 'endurance'] },
      { id: 'fitness_frequency', type: 'single' as const, options: ['rarely', 'weekly', 'regular', 'daily'] },
    ],
  },
};

const categoryOrder = ['entertainment', 'entertainment_games', 'shopping', 'food', 'travel', 'fitness'];

// 根据翻译生成问卷
export function getLocalizedQuestions(translations: any): CategoryQuestions[] {
  const questionsTranslations = translations.onboarding?.questions;
  if (!questionsTranslations) {
    console.warn('No onboarding questions translations found');
    return [];
  }

  return categoryOrder.map(category => {
    const categoryTranslation = questionsTranslations[category];
    const structure = questionStructure[category as keyof typeof questionStructure];

    if (!categoryTranslation || !structure) {
      return null;
    }

    const questions: Question[] = structure.questions.map(q => {
      const questionTranslation = categoryTranslation[q.id];
      if (!questionTranslation) return null;

      const icons = questionIcons[category]?.[q.id] || {};

      return {
        id: q.id,
        type: q.type,
        question: questionTranslation.question,
        description: questionTranslation.description,
        options: q.options.map(optId => ({
          id: optId,
          label: questionTranslation.options?.[optId] || optId,
          icon: icons[optId],
        })),
      };
    }).filter(Boolean) as Question[];

    return {
      category,
      title: categoryTranslation.title,
      description: categoryTranslation.description,
      questions,
    };
  }).filter(Boolean) as CategoryQuestions[];
}

// 根据分类获取问卷
export function getQuestionsByCategory(translations: any, category: string): CategoryQuestions | undefined {
  const allQuestions = getLocalizedQuestions(translations);
  return allQuestions.find(q => q.category === category || q.category.startsWith(category));
}

// 获取所有分类信息
export function getAllCategories(translations: any): { id: string; title: string; description: string }[] {
  const allQuestions = getLocalizedQuestions(translations);
  return allQuestions.map(q => ({
    id: q.category,
    title: q.title,
    description: q.description
  }));
}

// 保持向后兼容 - 使用中文作为默认
export const allQuestions: CategoryQuestions[] = [];
