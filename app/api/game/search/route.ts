import { NextRequest, NextResponse } from 'next/server';
import {
  GAME_PLATFORMS,
  GameType,
  identifyGameType,
  selectGamePlatforms,
  getGamePlatformsByRegion,
  getGamePlatformsByType
} from '@/lib/search/search-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameName = searchParams.get('gameName') || '';
    const region = searchParams.get('region') as 'cn' | 'intl' || 'cn';
    const keywords = searchParams.get('keywords')?.split(',') || [];
    const limit = parseInt(searchParams.get('limit') || '5');
    const gameType = searchParams.get('gameType') as GameType;
    const action = searchParams.get('action') || 'search';

    // 验证参数
    if (!gameName && action === 'search') {
      return NextResponse.json(
        { error: '游戏名称不能为空' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'search':
        // 智能搜索游戏平台
        const platforms = selectGamePlatforms(gameName, region, keywords, limit);
        const gameTypes = identifyGameType(gameName, keywords);

        // 为每个平台生成搜索链接
        const searchResults = platforms.map(platform => ({
          id: platform.id,
          name: platform.name,
          url: platform.url,
          searchUrl: platform.searchUrl(gameName),
          gameTypes: platform.gameTypes,
          region: platform.region
        }));

        return NextResponse.json({
          success: true,
          data: {
            gameName,
            gameTypes,
            region,
            platforms: searchResults
          }
        });

      case 'list':
        // 获取平台列表
        if (gameType) {
          // 按游戏类型筛选
          const platforms = getGamePlatformsByType(gameType, region);
          return NextResponse.json({
            success: true,
            data: {
              gameType,
              region,
              platforms
            }
          });
        } else {
          // 按地区获取所有平台
          const platforms = getGamePlatformsByRegion(region);
          return NextResponse.json({
            success: true,
            data: {
              region,
              platforms
            }
          });
        }

      case 'identify':
        // 识别游戏类型
        const identifiedTypes = identifyGameType(gameName, keywords);
        return NextResponse.json({
          success: true,
          data: {
            gameName,
            keywords,
            gameTypes: identifiedTypes
          }
        });

      default:
        return NextResponse.json(
          { error: '无效的操作类型' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Game search API error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameNames, region = 'cn', limit = 3 } = body;

    if (!Array.isArray(gameNames) || gameNames.length === 0) {
      return NextResponse.json(
        { error: '游戏名称列表不能为空' },
        { status: 400 }
      );
    }

    // 批量搜索多个游戏
    const batchResults = gameNames.map(gameName => {
      const platforms = selectGamePlatforms(gameName, region, [], limit);
      const gameTypes = identifyGameType(gameName);

      return {
        gameName,
        gameTypes,
        platforms: platforms.map(platform => ({
          id: platform.id,
          name: platform.name,
          url: platform.url,
          searchUrl: platform.searchUrl(gameName),
          gameTypes: platform.gameTypes,
          region: platform.region
        }))
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        region,
        results: batchResults
      }
    });

  } catch (error) {
    console.error('Batch game search API error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}