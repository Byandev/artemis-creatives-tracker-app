import { CircleCheck, Film, ImageOff, Search, SearchX, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreativeRow } from '@/components/creatives/creative-row';
import { CreativeListSkeleton } from '@/components/creatives/creative-row-skeleton';
import { SearchBar } from '@/components/creatives/search-bar';
import { TypeFilter, type TypeFilterValue } from '@/components/creatives/type-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/top-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { useAssignedCreatives } from '@/hooks/use-assigned-creatives';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';

export default function CreativesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [type, setType] = useState<TypeFilterValue>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim());

  const { items, total, error, isLoading, isRefreshing, isLoadingMore, refresh, loadMore, retry } =
    useAssignedCreatives({ search, format: type });

  // While a new search or format loads, show skeletons instead of the previous results.
  const visible = isLoading ? [] : items;

  function closeSearch() {
    setSearching(false);
    setQuery('');
  }

  function renderEmpty() {
    if (isLoading) {
      return <CreativeListSkeleton />;
    }
    if (error) {
      return (
        <EmptyState
          icon={WifiOff}
          tone="error"
          title="Couldn't load creatives"
          description={error}
          action={{ label: 'Try again', onPress: retry }}
        />
      );
    }
    if (search) {
      return (
        <EmptyState
          icon={SearchX}
          title={`No results for "${search}"`}
          description={`Try a different name, code or headline${type === 'all' ? '' : `, or search all formats`}.`}
          action={
            type === 'all'
              ? { label: 'Clear search', onPress: () => setQuery('') }
              : { label: 'Search all formats', onPress: () => setType('all') }
          }
        />
      );
    }
    if (type !== 'all') {
      return (
        <EmptyState
          icon={type === 'video' ? Film : ImageOff}
          title={`No ${type} creatives`}
          description={`There are no ${type} creatives waiting for your review.`}
          action={{ label: 'Show all creatives', onPress: () => setType('all') }}
        />
      );
    }
    return (
      <EmptyState
        icon={CircleCheck}
        tone="positive"
        title="You're all caught up"
        description="No creatives are waiting for your review. Pull down to check again."
      />
    );
  }

  function renderFooter() {
    if (isLoadingMore) {
      return (
        <View className="items-center py-6">
          <ActivityIndicator colorClassName="accent-primary" />
        </View>
      );
    }
    if (error && visible.length > 0) {
      return (
        <Pressable accessibilityRole="button" onPress={retry} className="items-center py-6">
          <ThemedText type="label" tone="primary">
            Couldn't load more. Tap to retry.
          </ThemedText>
        </Pressable>
      );
    }
    return null;
  }

  return (
    <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
      {searching ? (
        <SearchBar value={query} onChangeText={setQuery} onCancel={closeSearch} />
      ) : (
        <TopBar
          title="Creatives for Review"
          actions={[{ icon: Search, label: 'Search creatives', onPress: () => setSearching(true) }]}
        />
      )}
      <TypeFilter total={isLoading ? null : total} value={type} onChange={setType} />

      <FlatList
        data={visible}
        keyExtractor={(creative) => String(creative.id)}
        renderItem={({ item }) => <CreativeRow creative={item} />}
        ListHeaderComponent={
          visible.length > 0 ? (
            <View className="flex-row items-center gap-2 px-4 pb-2 pt-6">
              <ThemedText type="sectionLabel" tone="muted">
                Needs review
              </ThemedText>
              <ThemedText type="caption" tone="pending">
                {total}
              </ThemedText>
            </View>
          ) : null
        }
        ListEmptyComponent={renderEmpty()}
        ListFooterComponent={renderFooter()}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.surface}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="pb-4"
      />
    </ThemedView>
  );
}
