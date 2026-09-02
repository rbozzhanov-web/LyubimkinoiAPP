import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Platform, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
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

const RETURN_SPRING = { stiffness: 300, damping: 30, mass: 0.82, useNativeDriver: true } as const;
const PAGE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const WEB_COMPOSITE = Platform.OS === 'web'
  ? ({ willChange: 'transform', backfaceVisibility: 'hidden' } as any)
  : undefined;

export function SwipeSurface({ children, style, onSwipeLeft, onSwipeRight, onSwipeDown, threshold = 52, dominance = 1.25 }: Props) {
  const translation = useRef(new Animated.ValueXY()).current;
  const activeAxis = useRef<SwipeAxis | undefined>(undefined);
  const size = useRef({ width: 360, height: 640 });
  const transitioning = useRef(false);

  const reset = useCallback(() => {
    translation.setValue({ x: 0, y: 0 });
    transitioning.current = false;
  }, [translation]);

  const settle = useCallback(() => {
    Animated.spring(translation, { toValue: { x: 0, y: 0 }, ...RETURN_SPRING }).start(() => {
      transitioning.current = false;
    });
  }, [translation]);

  const completeHorizontal = useCallback((direction: -1 | 1, callback: () => void) => {
    if (transitioning.current) return;
    transitioning.current = true;
    const width = Math.max(260, size.current.width);

    Animated.timing(translation.x, {
      toValue: direction * width,
      duration: 210,
      easing: PAGE_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) { settle(); return; }

      callback();
      translation.setValue({ x: -direction * width, y: 0 });
      Animated.timing(translation.x, {
        toValue: 0,
        duration: 240,
        easing: PAGE_EASING,
        useNativeDriver: true,
      }).start(() => reset());
    });
  }, [reset, settle, translation]);

  const completeDown = useCallback((callback: () => void) => {
    if (transitioning.current) return;
    transitioning.current = true;
    const height = Math.max(360, size.current.height);
    Animated.timing(translation.y, {
      toValue: height + 56,
      duration: 220,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) callback();
      reset();
    });
  }, [reset, translation]);

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      if (transitioning.current) return false;
      const absX = Math.abs(gesture.dx);
      const absY = Math.abs(gesture.dy);
      if (absX < 10 && absY < 10) return false;
      activeAxis.current = swipeAxis(gesture.dx, gesture.dy, Boolean(onSwipeLeft || onSwipeRight), Boolean(onSwipeDown), dominance);
      return activeAxis.current !== undefined;
    },
    onPanResponderGrant: () => {
      translation.stopAnimation();
      translation.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (_, gesture) => {
      if (activeAxis.current === 'horizontal') {
        const unavailable = (gesture.dx < 0 && !onSwipeLeft) || (gesture.dx > 0 && !onSwipeRight);
        translation.setValue({ x: unavailable ? gesture.dx * 0.18 : gesture.dx, y: 0 });
      } else if (activeAxis.current === 'down') {
        const raw = Math.max(0, gesture.dy);
        const y = raw <= 300 ? raw : 300 + (raw - 300) * 0.28;
        translation.setValue({ x: 0, y });
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
  }), [completeDown, completeHorizontal, dominance, onSwipeDown, onSwipeLeft, onSwipeRight, settle, threshold, translation]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0) size.current.width = width;
    if (height > 0) size.current.height = height;
  }, []);

  return <Animated.View
    onLayout={onLayout}
    style={[style, WEB_COMPOSITE, { transform: translation.getTranslateTransform() }]}
    {...responder.panHandlers}
  >
    {children}
  </Animated.View>;
}
