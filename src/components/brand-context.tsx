'use client';
import { createContext, useContext } from 'react';
import { DEFAULT_BRAND, type Brand } from '@/lib/brand';

const Ctx = createContext<Brand>(DEFAULT_BRAND);
export const BrandProvider = ({ brand, children }: { brand: Brand; children: React.ReactNode }) => <Ctx.Provider value={brand}>{children}</Ctx.Provider>;
export const useBrand = () => useContext(Ctx);
