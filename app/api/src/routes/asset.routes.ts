import { Router } from 'express';
import { PrismaClient, AssetCategory, DepreciationMethod, AssetStatus } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { calculateDepreciation } from '../utils/helpers';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { page = 1, pageSize = 50, search, category, status } = req.query;
  
  const where: any = { school_id: req.user!.schoolId };
  if (search) {
    where.OR = [
      { asset_code: { contains: search as string, mode: 'insensitive' } },
      { asset_name_ar: { contains: search as string, mode: 'insensitive' } },
      { asset_name_en: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;
  if (status) where.status = status;

  const [assets, total] = await Promise.all([
    prisma.fixedAsset.findMany({
      where,
      include: { vendor: { select: { vendor_name_ar: true, vendor_name_en: true } }, department: true },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { asset_code: 'asc' },
    }),
    prisma.fixedAsset.count({ where }),
  ]);

  res.json({ success: true, data: assets, meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } });
}));

router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const asset = await prisma.fixedAsset.findFirst({
    where: { id: req.params.id, school_id: req.user!.schoolId },
    include: { vendor: true, department: true, asset_account: true, depreciation_account: true },
  });
  if (!asset) throw new AppError('Asset not found', 404);
  res.json({ success: true, data: asset });
}));

router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const data = req.body;
  const authReq = req as AuthRequest;

  const purchasePrice = Number(data.purchase_price);
  const residualValue = Number(data.residual_value) || 0;
  const usefulLifeYears = data.useful_life_years;

  let depreciationRate = 0;
  if (data.depreciation_method === 'STRAIGHT_LINE') {
    depreciationRate = (100 / usefulLifeYears);
  } else {
    depreciationRate = (200 / usefulLifeYears);
  }

  const depr = calculateDepreciation(purchasePrice, residualValue, usefulLifeYears, data.depreciation_method, 1);

  const asset = await prisma.fixedAsset.create({
    data: {
      ...data,
      purchase_price: purchasePrice,
      residual_value: residualValue,
      depreciation_rate: depreciationRate,
      accumulated_depreciation: depr.accumulatedDepreciation,
      net_book_value: depr.netBookValue,
      school_id: authReq.user!.schoolId,
    },
  });

  res.status(201).json({ success: true, data: asset, message: 'Asset registered successfully' });
}));

router.post('/depreciation/run', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { as_of_date } = req.body;
  const authReq = req as AuthRequest;

  const assets = await prisma.fixedAsset.findMany({
    where: { school_id: authReq.user!.schoolId, status: 'ACTIVE' },
  });

  let processedCount = 0;
  const now = new Date(as_of_date || new Date());

  for (const asset of assets) {
    const purchaseDate = new Date(asset.purchase_date);
    const yearsElapsed = (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const currentYear = Math.floor(yearsElapsed) + 1;

    const depr = calculateDepreciation(
      Number(asset.purchase_price),
      Number(asset.residual_value),
      asset.useful_life_years,
      asset.depreciation_method as 'STRAIGHT_LINE' | 'DECLINING_BALANCE',
      currentYear
    );

    await prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        accumulated_depreciation: depr.accumulatedDepreciation,
        net_book_value: depr.netBookValue,
        status: depr.netBookValue <= 0 ? 'FULLY_DEPRECIATED' : 'ACTIVE',
      },
    });

    processedCount++;
  }

  res.json({ success: true, data: { processed_count: processedCount }, message: 'Depreciation run completed' });
}));

export default router;