import { useFocusEffect } from 'expo-router';
import { Bell, ChevronRight, Clock, LogOut, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatTime, TimePickerSheet } from '@/components/time-picker-sheet';
import { TopBar } from '@/components/top-bar';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, reminderApi, type DailyReminder } from '@/lib/api';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPermissionState,
  isNotificationsEnabled,
  pushUnsupportedReason,
} from '@/lib/notifications';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';
import { useSession } from '@/providers/session';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { token, user, refreshUser, signOut } = useSession();
  const { preference, setPreference } = useThemePreference();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await refreshUser();
      setError(null);
    } catch (err) {
      // Keep showing the saved profile; just say it couldn't be refreshed.
      setError(err instanceof ApiError && err.status === 0 ? err.message : "Couldn't refresh your profile.");
    }
  }, [refreshUser]);

  // Notifications: on/off, plus why it can't be turned on (unsupported build, permission denied).
  const unsupported = pushUnsupportedReason();
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (unsupported) return;
    const [enabled, permission] = await Promise.all([isNotificationsEnabled(), getPermissionState()]);
    setPermissionDenied(permission === 'denied');
    setNotificationsOn(enabled && permission === 'granted');
  }, [unsupported]);

  async function toggleNotifications(next: boolean) {
    if (!token) return;
    setNotificationsBusy(true);
    setNotificationsError(null);
    try {
      if (next) {
        await enablePushNotifications(token);
      } else {
        await disablePushNotifications(token);
      }
      setNotificationsOn(next);
    } catch (err) {
      setNotificationsOn(false);
      setNotificationsError(err instanceof Error ? err.message : 'Couldn’t turn on notifications.');
      await loadNotifications();
    } finally {
      setNotificationsBusy(false);
    }
  }

  // Daily reminder: saved on the server, which sends the push at this time (Asia/Manila).
  const [reminder, setReminder] = useState<DailyReminder | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const loadReminder = useCallback(async () => {
    if (!token || unsupported) return;
    try {
      setReminder((await reminderApi.get(token)).daily_reminder);
      setReminderError(null);
    } catch {
      setReminderError('Couldn’t load your reminder time.');
    }
  }, [token, unsupported]);

  /** Saves right away; shows the change immediately and puts it back if saving fails. */
  async function saveReminder(next: { enabled: boolean; time: string }) {
    if (!token || !reminder) return;
    const previous = reminder;
    setReminder({ ...reminder, ...next });
    setReminderError(null);
    try {
      setReminder((await reminderApi.update(token, next)).daily_reminder);
    } catch (err) {
      setReminder(previous);
      setReminderError(err instanceof ApiError && err.status === 0 ? err.message : 'Couldn’t save your reminder.');
    }
  }

  // GET /me every time the tab is opened, so name and email stay current.
  // Notification permission is re-read too, in case it was changed in phone settings.
  useFocusEffect(
    useCallback(() => {
      load();
      loadNotifications();
      loadReminder();
    }, [load, loadNotifications, loadReminder]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadReminder()]);
    setRefreshing(false);
  }

  return (
    <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
      <TopBar title="Profile" />
      <ScrollView
        contentContainerClassName="gap-8 px-4 pb-8 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.surface}
          />
        }>
        {/* Account */}
        <View className="flex-row items-center gap-4 rounded-md border border-border bg-surface p-4">
          {user ? (
            <>
              <View className="size-14 items-center justify-center rounded-full bg-badge-active">
                <ThemedText type="pageTitle" tone="primary">
                  {initials(user.name)}
                </ThemedText>
              </View>
              <View className="flex-1 gap-0.5">
                <ThemedText type="pageTitle" numberOfLines={1}>
                  {user.name}
                </ThemedText>
                <ThemedText tone="muted" numberOfLines={1}>
                  {user.email}
                </ThemedText>
              </View>
            </>
          ) : (
            <>
              <View className="size-14 rounded-full bg-border" />
              <View className="flex-1 gap-2">
                <View className="h-4 w-2/5 rounded-sm bg-border" />
                <View className="h-3 w-3/5 rounded-sm bg-border" />
              </View>
            </>
          )}
        </View>

        {error && (
          <Pressable accessibilityRole="button" onPress={load} className="-mt-5">
            <ThemedText type="meta" tone="rejected">
              {error} Tap to retry.
            </ThemedText>
          </Pressable>
        )}

        {/* Appearance */}
        <View className="gap-3">
          <ThemedText type="sectionLabel" tone="muted">
            Appearance
          </ThemedText>
          <View accessibilityRole="radiogroup" className="flex-row gap-1 rounded-md border border-border bg-surface p-1">
            {THEME_OPTIONS.map((option) => {
              const active = option.value === preference;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${option.label} theme`}
                  onPress={() => setPreference(option.value)}
                  className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-sm ${
                    active ? 'bg-badge-active' : 'active:bg-row-hover'
                  }`}>
                  <Icon as={option.icon} size={18} className={active ? 'text-primary' : 'text-muted'} />
                  <ThemedText type={active ? 'labelActive' : 'label'} tone={active ? 'primary' : 'muted'}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="meta" tone="muted">
            {preference === 'system'
              ? 'Follows your device setting.'
              : `Always uses ${preference} mode on this device.`}
          </ThemedText>
        </View>

        {/* Notifications */}
        <View className="gap-3">
          <ThemedText type="sectionLabel" tone="muted">
            Notifications
          </ThemedText>
          <View className="flex-row items-center gap-3 rounded-md border border-border bg-surface p-4">
            <View className="size-10 items-center justify-center rounded-full bg-badge-active">
              <Icon as={Bell} size={20} className="text-primary" />
            </View>
            <View className="flex-1 gap-0.5">
              <ThemedText type="rowTitle">Push notifications</ThemedText>
              <ThemedText type="meta" tone="muted">
                New creatives assigned to you, and a daily reminder when reviews are waiting.
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel="Push notifications"
              value={notificationsOn}
              onValueChange={toggleNotifications}
              disabled={!!unsupported || notificationsBusy || !token}
              trackColor={{ false: theme.inputBorder, true: theme.button }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.inputBorder}
            />
          </View>
          {unsupported ? (
            <ThemedText type="meta" tone="muted">
              {unsupported}
            </ThemedText>
          ) : notificationsError || (permissionDenied && !notificationsOn) ? (
            <View className="flex-row flex-wrap items-center gap-x-2">
              <ThemedText type="meta" tone="rejected">
                {notificationsError ?? 'Notifications are turned off for Artemis in your phone settings.'}
              </ThemedText>
              {permissionDenied && (
                <Pressable accessibilityRole="link" onPress={() => Linking.openSettings()}>
                  <ThemedText type="label" tone="primary">
                    Open settings
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : null}

          {notificationsOn && reminder && (
            <View className="flex-row items-center gap-3 rounded-md border border-border bg-surface p-4">
              <View className="size-10 items-center justify-center rounded-full bg-badge-active">
                <Icon as={Clock} size={20} className="text-primary" />
              </View>
              <View className="flex-1 gap-1">
                <ThemedText type="rowTitle">Daily reminder</ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reminder time, ${formatTime(reminder.time)}. Change time`}
                  disabled={!reminder.enabled}
                  onPress={() => setTimePickerOpen(true)}
                  hitSlop={8}
                  className="flex-row items-center gap-1 self-start">
                  <ThemedText type="label" tone={reminder.enabled ? 'primary' : 'muted'}>
                    {reminder.enabled ? `Every day at ${formatTime(reminder.time)}` : 'Off'}
                  </ThemedText>
                  {reminder.enabled && <Icon as={ChevronRight} size={16} className="text-primary" />}
                </Pressable>
                <ThemedText type="meta" tone="muted">
                  Only sent when creatives are waiting for your review. Philippine time.
                </ThemedText>
              </View>
              <Switch
                accessibilityLabel="Daily reminder"
                value={reminder.enabled}
                onValueChange={(enabled) => saveReminder({ enabled, time: reminder.time })}
                trackColor={{ false: theme.inputBorder, true: theme.button }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.inputBorder}
              />
            </View>
          )}
          {notificationsOn && reminderError && (
            <Pressable accessibilityRole="button" onPress={loadReminder}>
              <ThemedText type="meta" tone="rejected">
                {reminderError} Tap to retry.
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* Account actions */}
        <View className="gap-3">
          <ThemedText type="sectionLabel" tone="muted">
            Account
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            className="h-12 flex-row items-center justify-center gap-2 rounded-md border border-input-border bg-surface active:bg-row-hover">
            <Icon as={LogOut} className="text-rejected" />
            <ThemedText type="button" tone="rejected">
              Log out
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      {reminder && (
        <TimePickerSheet
          visible={timePickerOpen}
          title="Daily reminder time"
          value={reminder.time}
          onClose={() => setTimePickerOpen(false)}
          onSelect={(time) => {
            setTimePickerOpen(false);
            saveReminder({ enabled: true, time });
          }}
        />
      )}
    </ThemedView>
  );
}

/** "Juan Dela Cruz" → "JC" */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}
