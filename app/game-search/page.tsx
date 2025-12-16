import GameSearchEngine from '@/components/GameSearchEngine';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '游戏平台搜索引擎',
  description: '智能识别游戏类型，自动推荐最佳游戏平台 - 支持20个主流游戏平台',
};

export default function GameSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <GameSearchEngine />
      </div>
    </div>
  );
}