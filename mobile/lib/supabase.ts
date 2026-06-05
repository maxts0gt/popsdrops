import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const mobileSessionStorage = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      return Promise.resolve(window.localStorage.getItem(key));
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    }

    return SecureStore.setItemAsync(key, value, secureStoreOptions);
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(key);
      return Promise.resolve();
    }

    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mobileSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
