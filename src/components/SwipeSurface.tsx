import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
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

const SPRING = { stiffness: 330, damping: 31, mass: 0.78, useNativeDriver: true } as const;

export function SwipeSurface({ children, style, onSwipeLeft, onSwipeRight, onSwipeDown, threshold = 52, dominance = 1.25 }: Props) {
  const translation = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const activeAxis = useRef<SwipeAxis | undefined>(undefined);
  const size = useRef({ width: 360, height: 640 });
  const [dragging, setDragging] = useState(false);

  const resetVisuals = useCallback(() => {
    translation.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
    scale.setValue(1);
  }, [opacity, scale, translation]);

  const settle = useCallback(() => {
    Animated.parallel([
      Animated.spring(translation, { toValue: { x: 0, y: 0 }, ...SPRING }),
      Animated.spring(scale, { toValue: 1, ...SPRING }),
      Animated.timing(opacity, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => setDragging(false));
  }, [opacity, scale, translation]);

  const completeHorizontal = useCallback((direction: -1 | 1, callback: () => void) => {
    const width = Math.max(260, size.current.width);
    const exit = direction * Math.min(width * 0.34, 180);
    Animated.parallel([
      Animated.timing(translation.x, { toValue: exit, duration: 145, easing: Easing.bezier(0.2, 0.78, 0.2, 1), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.22, duration: 135, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.985, duration: 145, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) { settle(); return; }
      callback();
      translation.setValue({ x: -direction * Math.min(width * 0.12, 54), y: 0 });
      opacity.setValue(0.72);
      scale.setValue(0.992);
      Animated.parallel([
        Animated.spring(translation.x, { toValue: 0, ...SPRING }),
        Animated.spring(scale, { toValue: 1, ...SPRING }),
        Animated.timing(opacity, { toValue: 1, duration: 165, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        resetVisuals();
        setDragging(false);
      });
    });
  }, [opacity, resetVisuals, scale, settle, translation]);

  const completeDown = useCallback((callback: () => void) => {
    const height = Math.max(360, size.current.height);
    Animated.parallel([
      Animated.timing(translation.y, { toValue: height + 56, duration: 220, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.82, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) callback();
      resetVisuals();
      setDragging(false);
    });
  }, [opacity, resetVisuals, translation]);

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      const absX = Math.abs(gesture.dx);
      const absY = Math.abs(gesture.dy);
      if (absX < 10 && absY < 10) return false;
      activeAxis.current = swipeAxis(gesture.dx, gesture.dy, Boolean(onSwipeLeft || onSwipeRight), Boolean(onSwipeDown), dominance);
      return activeAxis.current !== undefined;
    },
    onPanResponderGrant: () => {
      translation.stopAnimation();
      opacity.stopAnimation();
      scale.stopAnimation();
      resetVisuals();
      setDragging(true);
    },
    onPanResponderMove: (_, gesture) => {
      if (activeAxis.current === 'horizontal') {
        const unavailable = (gesture.dx < 0 && !onSwipeLeft) || (gesture.dx > 0 && !onSwipeRight);
        const dx = unavailable ? gesture.dx * 0.22 : gesture.dx;
        const progress = Math.min(Math.abs(dx) / Math.max(1, size.current.width), 1);
        translation.setValue({ x: dx, y: 0 });
        scale.setValue(1 - progress * 0.012);
        opacity.setValue(1 - progress * 0.08);
      } else if (activeAxis.current === 'down') {
        const raw = Math.max(0, gesture.dy);
        const y = raw <= 300 ? raw : 300 + (raw - 300) * 0.28;
        translation.setValue({ x: 0, y });
        opacity.setValue(1 - Math.min(y / 900, 0.12));
      }
    },
    onPanResponderRelease: (_, gesture) => {
      const absX = Math.abs(gesture.dx);
      const absY = Math.abs(gesture.dy);
      const horizontal = activeAxis.current === 'horizontal' && absX > absY * dominance;
      const vertical = activeAxis.current === 'down' && absY > absX * dominance;
      const fastHorizontal = absX >= 18 && Math.abs(gesture.vx) >= 0.52;
      const fastDown = gesture.dy >= 18 && gesture.vy >= 0.68;

      activeAxis.current = undefined;
      if (horizontal && (absX >= threshold || fastHorizontal)) {
        if (gesture.dx < 0 && onSwipeLeft) { completeHorizontal(-1, onSwipeLeft); return; }
        if (gesture.dx > 0 && onSwipeRight) { completeHorizontal(1, onSwipeRight); return; }
      }
      if (vertical && (gesture.dy >= threshold || fastDown) && onSwipeDown) {
        completeDown(onSwipeDown);
        return;
      }
      settle();
    },
    onPanResponderTerminate: () => {
      activeAxis.current = undefined;
      settle();
    },
    onPanResponderTerminationRequest: () => true,
  }), [completeDown, completeHorizontal, dominance, onSwipeDown, onSwipeLeft, onSwipeRight, opacity, resetVisuals, scale, settle, threshold, translation]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0) size.current.width = width;
    if (height > 0) size.current.height = height;
  }, []);

  return <Animated.View
    onLayout={onLayout}
    style={[style, dragging && styles.elevated, { opacity, transform: [...translation.getTranslateTransform(), { scale }] }]}
    {...responder.panHandlers}
  >
    {children}
  </Animated.View>;
}

const styles = StyleSheet.create({
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
});
