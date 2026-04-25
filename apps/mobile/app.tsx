import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// TODO: Import screens when created
// import HomeScreen from './screens/HomeScreen';
// import AgentExploreScreen from './screens/AgentExploreScreen';
// import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { backgroundColor: '#000000', borderTopColor: '#1f2937' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={PlaceholderScreen}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Agents"
        component={PlaceholderScreen}
        options={{
          title: 'Agents',
          tabBarLabel: 'Agents',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={PlaceholderScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

function PlaceholderScreen() {
  return (
    <GestureHandlerRootView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar barStyle="light-content" />
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#000000' },
          }}
        >
          <Stack.Screen name="HomeTabs" component={HomeTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
