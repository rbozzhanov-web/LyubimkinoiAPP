import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { swipeAxis, type SwipeAxis } from '@/src/domain/gesture';

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
  const translation = useRef(new Animated.ValueXY()).current;
  const activeAxis = useRef<SwipeAxis | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const settle = () => Animated.spring(translation, {
    toValue: { x: 0, y: 0 }, useNativeDriver: true, stiffness: 280, damping: 26, mass: 0.7,
  }).start(() => setDragging(false));

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      const absX = Math.abs(gesture.dx);
      const absY = Math.abs(gesture.dy);
      if (absX < 14 && absY < 14) return false;
      activeAxis.current = swipeAxis(gesture.dx, gesture.dy, Boolean(onSwipeLeft || onSwipeRight), Boolean(onSwipeDown), dominance);
      return activeAxis.current !== undefined;
    },
    onPanResponderGrant: () => { translation.setValue({ x: 0, y: 0 }); setDragging(true); },
    onPanResponderMove: (_, gesture) => {
      if (activeAxis.current === 'horizontal') translation.setValue({ x: gesture.dx, y: 0 });
      else if (activeAxis.current === 'down') translation.setValue({ x: 0, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => {
      const absX = Math.abs(gesture.dx);
      const absY = Math.abs(gesture.dy);
      if (absX >= threshold && absX > absY * dominance) {
        if (gesture.dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
      } else if (gesture.dy >= threshold && absY > absX * dominance) onSwipeDown?.();
      activeAxis.current = undefined;
      settle();
    },
    onPanResponderTerminate: () => { activeAxis.current = undefined; settle(); },
    onPanResponderTerminationRequest: () => true,
  }), [dominance, onSwipeDown, onSwipeLeft, onSwipeRight, settle, threshold, translation]);

  return <Animated.View style={[style, dragging && styles.elevated, { transform: translation.getTranslateTransform() }]} {...responder.panHandlers}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  elevated: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: .18, shadowRadius: 24, elevation: 14,
  },
});
