import * as React from 'react';
import { View } from 'react-native';

type DragOverlayContextValue = {
  show: (content: React.ReactNode) => void;
  hide: () => void;
};

const DragOverlayContext = React.createContext<DragOverlayContextValue>({
  show: () => {},
  hide: () => {},
});

export function useDragOverlay() {
  return React.useContext(DragOverlayContext);
}

export function DragOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [content, setContent] = React.useState<React.ReactNode>(null);
  const show = React.useCallback((next: React.ReactNode) => {
    setContent(next);
  }, []);
  const hide = React.useCallback(() => {
    setContent(null);
  }, []);
  const value = React.useMemo(() => ({ show, hide }), [hide, show]);

  return (
    <DragOverlayContext.Provider value={value}>
      <View className="flex-1">
        {children}
        {content ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 overflow-visible"
            style={{ zIndex: 9999, elevation: 9999 }}
          >
            {content}
          </View>
        ) : null}
      </View>
    </DragOverlayContext.Provider>
  );
}
