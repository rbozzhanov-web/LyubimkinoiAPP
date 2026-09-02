import { useMemo, type ReactNode } from 'react';
import { PanResponder, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  dominance?: number;
};

export function SwipeSurface({ children, style, onSwipeLeft, onSwipeRight, onSwipeDown, threshold = 52, dominance = 1.25 }: Props) {
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      const absX = Math.abs(gesture.dx);
      const absY = Math.abs(gesture.dy);
      if (absX < 14 && absY < 14) return false;
      const horizontal = Boolean((onSwipeLeft || onSwipeRight) && absX > absY * dominance);
      const downward = Boolean(onSwipeDown && gesture.dy > 0 && absY > absX * dominance);
      return horizontal || downward;
    },
    onPanResponderRelease: (_, gesture) => {
      const absX = Math.abs(gesture.dx);
      const absY = Math.abs(gesture.dy);
      if (absX >= threshold && absX > absY * dominance) {
        if (gesture.dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
        return;
      }
      if (gesture.dy >= threshold && absY > absX * dominance) onSwipeDown?.();
    },
    onPanResponderTerminationRequest: () => true,
  }), [dominance, onSwipeDown, onSwipeLeft, onSwipeRight, threshold]);

  return <View style={style} {...responder.panHandlers}>{children}</View>;
}
