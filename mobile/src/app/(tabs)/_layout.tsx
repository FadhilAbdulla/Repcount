import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@/constants/theme';
import { DashboardProvider } from '@/lib/dashboard';

export default function TabLayout() {
  const t = useTheme();
  return (
    <DashboardProvider>
      <NativeTabs backgroundColor={t.card} indicatorColor={t.soft} labelStyle={{ selected: { color: t.brand } }} tintColor={t.brand}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="today" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="workout">
          <NativeTabs.Trigger.Label>Workout</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="dumbbell" md="fitness_center" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="coach">
          <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="forum" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </DashboardProvider>
  );
}
