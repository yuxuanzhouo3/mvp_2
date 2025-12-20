// app/api/subscription/export/route.ts - 历史记录导出API
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fontkit from '@pdf-lib/fontkit';
import { isChinaRegion } from "@/lib/config/region";
import * as fs from 'fs';
import * as path from 'path';

// 强制动态渲染，因为使用了request.headers
export const dynamic = 'force-dynamic';
import { canExportData, getUserRecommendationHistory } from "@/lib/subscription/usage-tracker";

// 检测文本是否包含非 ASCII 字符（中文等）
function hasNonAscii(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

// 分类名映射（支持中英文）
const categoryMapZh: Record<string, string> = {
  'entertainment': '娱乐',
  'shopping': '购物',
  'food': '美食',
  'travel': '旅行',
  'fitness': '健身',
  '娱乐': '娱乐',
  '购物': '购物',
  '美食': '美食',
  '旅游': '旅行',
  '健身': '健身',
};

const categoryMapEn: Record<string, string> = {
  'entertainment': 'Entertainment',
  'shopping': 'Shopping',
  'food': 'Food',
  'travel': 'Travel',
  'fitness': 'Fitness',
  '娱乐': 'Entertainment',
  '购物': 'Shopping',
  '美食': 'Food',
  '旅游': 'Travel',
  '健身': 'Fitness',
};

// 安全过滤文本，移除无法编码的字符
function sanitizeTextForPdf(text: string, useChinese: boolean): string {
  if (!text) return useChinese ? '无' : 'N/A';

  // 如果支持中文字体，直接返回
  if (useChinese) return text;

  // 否则移除非 ASCII 字符，用描述性文本替代
  if (hasNonAscii(text)) {
    // 尝试提取英文部分
    const asciiPart = text.replace(/[^\x00-\x7F]/g, '').trim();
    if (asciiPart.length > 3) {
      return asciiPart;
    }
    return '[Chinese Content]';
  }
  return text;
}

// 获取中文字体（优先本地，备用网络CDN）
async function fetchChineseFont(): Promise<ArrayBuffer | null> {
  // 1. 首先尝试从本地文件系统读取字体（优先 OTF 格式）
  const localFontPaths = [
    path.join(process.cwd(), 'public', 'fonts', 'NotoSansSC-Regular.otf'),
    path.join(process.cwd(), 'public', 'fonts', 'SourceHanSansSC-Regular.otf'),
    path.join(process.cwd(), 'public', 'fonts', 'chinese-font.otf'),
  ];

  for (const fontPath of localFontPaths) {
    try {
      if (fs.existsSync(fontPath)) {
        console.log('[PDF Export] Found local font file:', fontPath);
        const fontBuffer = fs.readFileSync(fontPath);

        // 验证字体文件大小（至少 50KB）
        if (fontBuffer.byteLength >= 50000) {
          console.log('[PDF Export] Local font loaded, size:', fontBuffer.byteLength);
          return fontBuffer.buffer.slice(
            fontBuffer.byteOffset,
            fontBuffer.byteOffset + fontBuffer.byteLength
          );
        } else {
          console.warn('[PDF Export] Local font too small:', fontBuffer.byteLength);
        }
      }
    } catch (error) {
      console.warn('[PDF Export] Error reading local font:', fontPath, error);
    }
  }

  // 2. 如果本地没有字体，尝试从网络获取
  console.log('[PDF Export] No local font found, trying CDN sources...');

  const fontUrls = [
    // 阿里云 CDN - 思源黑体
    'https://at.alicdn.com/t/webfont_exmzz0mq6a9.ttf',
    // 字节跳动 CDN
    'https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/lxgw-wenkai-webfont/1.233/LXGWWenKai-Regular.ttf',
    // 75CDN - 思源黑体
    'https://lib.baomitu.com/fonts/noto-sans-sc/NotoSansSC-Regular.ttf',
    // Google Fonts (国际用户后备)
    'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG-0.ttf',
  ];

  for (const fontUrl of fontUrls) {
    try {
      console.log('[PDF Export] Trying font source:', fontUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(fontUrl, {
        headers: {
          'Accept': 'font/ttf,application/font-sfnt,application/x-font-ttf,*/*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[PDF Export] Font source returned:', response.status, fontUrl);
        continue;
      }

      const fontBuffer = await response.arrayBuffer();

      if (fontBuffer.byteLength < 100000) {
        console.warn('[PDF Export] Font file too small, skipping:', fontBuffer.byteLength, fontUrl);
        continue;
      }

      console.log('[PDF Export] Chinese font loaded from CDN, size:', fontBuffer.byteLength);
      return fontBuffer;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('[PDF Export] Font fetch timeout:', fontUrl);
      } else {
        console.warn('[PDF Export] Error fetching font:', fontUrl, error.message);
      }
      continue;
    }
  }

  console.error('[PDF Export] All font sources failed');
  return null;
}

// PDF生成函数 - 使用pdf-lib（纯JavaScript，无需文件系统访问）
async function generatePDF(history: { data: any[]; total: number; retentionDays: number }): Promise<Buffer> {
  console.log('[PDF Export] Starting PDF generation with pdf-lib...');
  console.log('[PDF Export] History data count:', history.data.length);

  // 根据部署区域决定语言（CN环境强制使用中文）
  const isCN = isChinaRegion();
  console.log('[PDF Export] Is China Region:', isCN);

  // 创建PDF文档
  const pdfDoc = await PDFDocument.create();

  // 注册 fontkit 以支持自定义字体
  pdfDoc.registerFontkit(fontkit.default || fontkit);

  // 中文环境：必须加载中文字体
  let chineseFont: any = null;
  let useChinese = false;

  if (isCN) {
    // CN环境：强制使用中文，必须加载中文字体
    console.log('[PDF Export] CN environment: Chinese is required');
    const fontData = await fetchChineseFont();
    if (!fontData) {
      throw new Error('无法加载中文字体，请稍后重试');
    }
    chineseFont = await pdfDoc.embedFont(fontData);
    useChinese = true;
    console.log('[PDF Export] Chinese font embedded successfully for CN environment');
  } else {
    // INTL环境：使用英文
    console.log('[PDF Export] INTL environment: Using English');
    useChinese = false;
  }

  // 加载标准字体作为后备
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 选择使用的字体
  const titleFont = useChinese ? chineseFont : helveticaBold;
  const bodyFont = useChinese ? chineseFont : helvetica;
  const headerFont = useChinese ? chineseFont : helveticaBold;

  // 页面设置
  const pageWidth = 595; // A4 width in points
  const pageHeight = 842; // A4 height in points
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // 颜色定义
  const headerColor = rgb(0.31, 0.27, 0.9); // #4F46E5
  const textColor = rgb(0.22, 0.25, 0.31); // #374151
  const grayColor = rgb(0.42, 0.45, 0.51); // #6B7280
  const lightGray = rgb(0.95, 0.95, 0.96); // #F3F4F6

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  // 绘制标题
  const title = useChinese ? '推荐历史导出' : 'Recommendation History Export';
  const titleWidth = titleFont.widthOfTextAtSize(title, 22);
  page.drawText(title, {
    x: (pageWidth - titleWidth) / 2,
    y: yPosition,
    size: 22,
    font: titleFont,
    color: textColor,
  });
  yPosition -= 30;

  // 绘制导出时间
  const exportDate = useChinese
    ? `导出时间: ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}`
    : `Exported on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  const exportDateWidth = bodyFont.widthOfTextAtSize(exportDate, 12);
  page.drawText(exportDate, {
    x: (pageWidth - exportDateWidth) / 2,
    y: yPosition,
    size: 12,
    font: bodyFont,
    color: grayColor,
  });
  yPosition -= 20;

  // 绘制统计信息
  const stats = useChinese
    ? `总记录数: ${history.total} | 保留天数: ${history.retentionDays} 天`
    : `Total Records: ${history.total} | Retention: ${history.retentionDays} days`;
  const statsWidth = bodyFont.widthOfTextAtSize(stats, 10);
  page.drawText(stats, {
    x: (pageWidth - statsWidth) / 2,
    y: yPosition,
    size: 10,
    font: bodyFont,
    color: grayColor,
  });
  yPosition -= 40;

  // 表格设置
  const colWidths = [80, 100, contentWidth - 180]; // Date, Category, Recommendation
  const rowHeight = 25;
  const cellPadding = 5;

  // 绘制表头
  const headerY = yPosition;
  page.drawRectangle({
    x: margin,
    y: headerY - rowHeight,
    width: contentWidth,
    height: rowHeight,
    color: headerColor,
  });

  // 表头文字
  const headers = useChinese ? ['日期', '分类', '推荐内容'] : ['Date', 'Category', 'Recommendation'];
  let xPos = margin + cellPadding;
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: xPos,
      y: headerY - rowHeight + 8,
      size: 11,
      font: headerFont,
      color: rgb(1, 1, 1), // white
    });
    xPos += colWidths[i];
  }
  yPosition = headerY - rowHeight;

  // 绘制数据行
  for (let rowIndex = 0; rowIndex < history.data.length; rowIndex++) {
    const item = history.data[rowIndex];
    const recommendation = item.recommendation as Record<string, unknown>;

    // 检查是否需要新页面
    if (yPosition - rowHeight < margin + 50) {
      // 添加页脚
      const footer = useChinese
        ? 'RandomLife 生成 - 您的个人发现平台'
        : 'Generated by RandomLife - Your Personal Discovery Platform';
      const footerWidth = bodyFont.widthOfTextAtSize(footer, 9);
      page.drawText(footer, {
        x: (pageWidth - footerWidth) / 2,
        y: margin / 2,
        size: 9,
        font: bodyFont,
        color: grayColor,
      });

      // 添加新页面
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }

    // 交替行背景色
    if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: yPosition - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: lightGray,
      });
    }

    // 提取数据
    const dateLocale = useChinese ? 'zh-CN' : 'en-US';
    const date = new Date(item.created_at).toLocaleDateString(dateLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // 处理分类名
    let categoryRaw = (recommendation?.category as string) || 'N/A';
    const categoryMap = useChinese ? categoryMapZh : categoryMapEn;
    let category = categoryMap[categoryRaw.toLowerCase()] || categoryMap[categoryRaw] || categoryRaw;
    category = sanitizeTextForPdf(category, useChinese);

    // 处理推荐内容
    let content = '';
    if (recommendation?.title) {
      content = recommendation.title as string;
    } else if (recommendation?.content) {
      content = String(recommendation.content);
    } else {
      content = useChinese ? '无' : 'N/A';
    }

    // 截断过长内容
    const maxContentLength = 50;
    if (content.length > maxContentLength) {
      content = content.substring(0, maxContentLength - 3) + '...';
    }
    content = sanitizeTextForPdf(content, useChinese);

    // 绘制单元格内容
    xPos = margin + cellPadding;
    const rowData = [date, category, content];

    for (let i = 0; i < rowData.length; i++) {
      // 截断文本以适应列宽
      let text = rowData[i];
      const maxWidth = colWidths[i] - cellPadding * 2;
      while (bodyFont.widthOfTextAtSize(text, 10) > maxWidth && text.length > 3) {
        text = text.substring(0, text.length - 4) + '...';
      }

      page.drawText(text, {
        x: xPos,
        y: yPosition - rowHeight + 8,
        size: 10,
        font: bodyFont,
        color: textColor,
      });
      xPos += colWidths[i];
    }

    yPosition -= rowHeight;
  }

  // 添加最后的页脚
  const footer = useChinese
    ? 'RandomLife 生成 - 您的个人发现平台'
    : 'Generated by RandomLife - Your Personal Discovery Platform';
  const footerWidth = bodyFont.widthOfTextAtSize(footer, 9);
  page.drawText(footer, {
    x: (pageWidth - footerWidth) / 2,
    y: margin / 2,
    size: 9,
    font: bodyFont,
    color: grayColor,
  });

  console.log('[PDF Export] PDF document created, saving...');

  // 保存PDF
  const pdfBytes = await pdfDoc.save();

  console.log('[PDF Export] PDF generation completed, size:', pdfBytes.length);

  return Buffer.from(pdfBytes);
}

/**
 * GET /api/subscription/export
 * 导出推荐历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const userId = user.id;

    // 检查导出权限
    const exportPermission = await canExportData(userId);
    if (!exportPermission.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: exportPermission.reason,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // 获取导出格式
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "json";

    // 验证格式是否支持
    if (!exportPermission.formats.includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: `Format '${format}' is not supported. Available formats: ${exportPermission.formats.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 获取历史记录
    console.log(`[Export API] Fetching history for user ${userId}, format: ${format}`);
    const history = await getUserRecommendationHistory(userId, { limit: 1000 });
    console.log(`[Export API] History fetched: ${history.total} records, ${history.data.length} data items`);

    if (format === "json") {
      return NextResponse.json({
        success: true,
        data: history.data,
        total: history.total,
        retentionDays: history.retentionDays,
        exportedAt: new Date().toISOString(),
      });
    }

    if (format === "csv") {
      // 生成CSV
      const csvRows: string[] = [];

      // 添加标题行
      csvRows.push("ID,Category,Recommendation,Created At");

      // 添加数据行
      for (const item of history.data) {
        const recommendation = item.recommendation as Record<string, unknown>;
        const csvRow = [
          item.id,
          (recommendation?.category as string) || "",
          JSON.stringify(recommendation?.content || recommendation).replace(/"/g, '""'),
          item.created_at,
        ]
          .map((field) => `"${field}"`)
          .join(",");
        csvRows.push(csvRow);
      }

      const csvContent = csvRows.join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="recommendations_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // PDF 格式
    if (format === "pdf") {
      try {
        console.log('[Export API] Starting PDF generation...');
        const pdfBuffer = await generatePDF(history);
        console.log('[Export API] PDF generated successfully, size:', pdfBuffer.length);

        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="recommendations_${new Date().toISOString().split("T")[0]}.pdf"`,
            "Content-Length": pdfBuffer.length.toString(),
          },
        });
      } catch (pdfError: any) {
        console.error("[Export API] PDF generation error:", {
          message: pdfError?.message,
          stack: pdfError?.stack,
          error: pdfError
        });
        return NextResponse.json(
          {
            success: false,
            error: `Failed to generate PDF: ${pdfError?.message || 'Unknown error'}`,
            details: pdfError?.stack
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Unknown format" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
