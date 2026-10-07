import AppTabs from '@/components/app-tabs';
import { useNotificationRouting } from '@/hooks/use-notification-routing';

export default function TabsLayout() {
  useNotificationRouting();
  return <AppTabs />;
}
