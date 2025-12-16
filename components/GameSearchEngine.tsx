'use client';

import { useState, useCallback } from 'react';
import { Search, Gamepad2, Monitor, Smartphone, Palette, Globe, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GamePlatform, GameType } from '@/lib/search/search-engine';

interface GameSearchResult {
  id: string;
  name: string;
  url: string;
  searchUrl: string;
  gameTypes: GameType[];
  region: 'cn' | 'intl';
}

interface GameSearchResponse {
  gameName: string;
  gameTypes: GameType[];
  region: 'cn' | 'intl';
  platforms: GameSearchResult[];
}

const gameTypeConfig = {
  [GameType.PC]: { icon: Monitor, label: 'PC游戏', color: 'bg-blue-100 text-blue-800' },
  [GameType.CONSOLE]: { icon: Gamepad2, label: '主机游戏', color: 'bg-purple-100 text-purple-800' },
  [GameType.MOBILE]: { icon: Smartphone, label: '手游', color: 'bg-green-100 text-green-800' },
  [GameType.INDIE]: { icon: Palette, label: '独立游戏', color: 'bg-orange-100 text-orange-800' }
};

export default function GameSearchEngine() {
  const [gameName, setGameName] = useState('');
  const [region, setRegion] = useState<'cn' | 'intl'>('cn');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GameSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!gameName.trim()) {
      setError('请输入游戏名称');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/game/search?gameName=${encodeURIComponent(gameName)}&region=${region}&action=search`);
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || '搜索失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [gameName, region]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6" />
            游戏平台搜索引擎
          </CardTitle>
          <CardDescription>
            智能识别游戏类型，自动推荐最佳游戏平台
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 基础搜索 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="输入游戏名称..."
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Select value={region} onValueChange={(value: 'cn' | 'intl') => setRegion(value)}>
              <SelectTrigger className="w-32">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {region === 'cn' ? '中国版' : '国际版'}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cn">
                  <div className="flex items-center gap-2">
                    <span>🇨🇳</span>
                    中国版
                  </div>
                </SelectItem>
                <SelectItem value="intl">
                  <div className="flex items-center gap-2">
                    <span>🌍</span>
                    国际版
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? '搜索中...' : '搜索'}
            </Button>
          </div>

          {/* 高级选项 */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                高级选项
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>支持的游戏类型</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(gameTypeConfig).map(([type, config]) => (
                      <Badge key={type} variant="outline" className={config.color}>
                        <config.icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>平台数量</Label>
                  <p className="text-sm text-gray-600">
                    {region === 'cn' ? '10个' : '10个'} 游戏平台
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 搜索结果 */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>搜索结果</CardTitle>
            <CardDescription>
              为 <strong>{results.gameName}</strong> 找到 {results.platforms.length} 个平台
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 游戏类型标签 */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium">识别的游戏类型：</span>
              {results.gameTypes.map((type) => {
                const config = gameTypeConfig[type];
                return (
                  <Badge key={type} className={config.color}>
                    <config.icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                );
              })}
            </div>

            {/* 平台列表 */}
            <div className="grid gap-4">
              {results.platforms.map((platform) => (
                <Card key={platform.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{platform.name}</h3>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {platform.gameTypes.map((type) => {
                          const config = gameTypeConfig[type];
                          return (
                            <Badge key={type} variant="outline" className="text-xs">
                              <config.icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          );
                        })}
                      </div>
                      <a
                        href={platform.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        搜索 "{results.gameName}"
                      </a>
                    </div>
                    <div className="ml-4">
                      <Button
                        asChild
                        size="sm"
                        onClick={() => window.open(platform.searchUrl, '_blank')}
                      >
                        <span>访问平台</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}