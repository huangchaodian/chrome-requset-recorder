import { useMemo } from 'react';
import type { RequestRecord } from '../../shared/types';
import {
  diffDimension,
  extractText,
  type DiffDimension,
  type DiffSegment,
} from '../utils/diff';

interface UseDiffResult {
  diffs: DiffSegment[];
  leftText: string;
  rightText: string;
  hasDiff: boolean;
}

/** 针对两条请求某个维度的差异计算 Hook */
export function useDiff(
  left: RequestRecord | null,
  right: RequestRecord | null,
  dimension: DiffDimension
): UseDiffResult {
  return useMemo(() => {
    if (!left || !right) return { diffs: [], leftText: '', rightText: '', hasDiff: false };
    const leftText = extractText(left, dimension);
    const rightText = extractText(right, dimension);
    const diffs = diffDimension(left, right, dimension);
    const hasDiff = diffs.some((d) => d.op !== 0);
    return { diffs, leftText, rightText, hasDiff };
  }, [left, right, dimension]);
}