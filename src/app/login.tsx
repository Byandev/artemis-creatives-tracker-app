import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoginBackdrop } from '@/components/login-backdrop';
import { LogoMark } from '@/components/logo-mark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useSession } from '@/providers/session';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string; code?: string };

const MESSAGES = {
  invalidCredentials: 'Incorrect email or password.',
  invalidCode: 'Incorrect code. Try again.',
  tooManyAttempts: 'Too many attempts. Wait 1 minute and try again.',
  generic: 'Something went wrong. Try again.',
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight();

  // Keep the whole form, including Log In, above the keyboard while it's open.
  useEffect(() => {
    if (keyboardHeight > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [keyboardHeight]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Errors under specific fields, and one form-level message (rate limit, network, etc.).
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Second step for accounts with two-factor authentication.
  const [twoFactor, setTwoFactor] = useState<null | 'code' | 'recovery'>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  function clearError(field: keyof FieldErrors) {
    setFieldErrors(({ [field]: _removed, ...others }) => others);
    setFormError(null);
  }

  /** Client-side checks so obviously incomplete forms never hit the API. */
  function validate(trimmedEmail: string, trimmedCode: string): FieldErrors {
    if (twoFactor === 'code') {
      return /^\d{6}$/.test(trimmedCode) ? {} : { code: 'Enter the 6-digit code from your authenticator app.' };
    }
    if (twoFactor === 'recovery') {
      return trimmedCode ? {} : { code: 'Enter one of your recovery codes.' };
    }
    const errors: FieldErrors = {};
    if (!trimmedEmail) errors.email = 'Enter your email.';
    else if (!EMAIL_PATTERN.test(trimmedEmail)) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Enter your password.';
    return errors;
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    const trimmedCode = twoFactorCode.trim();

    const errors = validate(trimmedEmail, trimmedCode);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await signIn({
        email: trimmedEmail,
        password,
        code: twoFactor === 'code' ? trimmedCode : undefined,
        recoveryCode: twoFactor === 'recovery' ? trimmedCode : undefined,
      });
    } catch (err) {
      handleLoginError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleLoginError(err: unknown) {
    if (!(err instanceof ApiError)) {
      setFormError(MESSAGES.generic);
      return;
    }

    // 422 + two_factor_required: password was right, now ask for the code.
    if (err.status === 422 && err.body.two_factor_required) {
      setTwoFactor('code');
      setTwoFactorCode('');
      return;
    }

    // 422 validation: show each message under its field.
    if (err.status === 422) {
      const { email: emailError, password: passwordError, code, recovery_code } = err.fieldErrors;
      const next: FieldErrors = twoFactor
        ? { code: code ?? recovery_code }
        : { email: emailError, password: passwordError };
      if (Object.values(next).some(Boolean)) {
        setFieldErrors(next);
      } else {
        setFormError(err.message);
      }
      return;
    }

    if (err.status === 401) {
      if (twoFactor) {
        // Wrong 2FA or recovery code: stay on the code screen.
        setFieldErrors({ code: MESSAGES.invalidCode });
        setTwoFactorCode('');
      } else {
        // Same answer for a wrong password or unknown email. Keep the email, clear the password.
        setFormError(MESSAGES.invalidCredentials);
        setPassword('');
        passwordRef.current?.focus();
      }
      return;
    }

    if (err.status === 429) {
      setFormError(MESSAGES.tooManyAttempts);
      return;
    }

    // status 0 = never reached the server; ApiError already has a "can't reach" message.
    setFormError(err.status === 0 ? err.message : MESSAGES.generic);
  }

  function leaveTwoFactor() {
    setTwoFactor(null);
    setTwoFactorCode('');
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <ThemedView className="flex-1">
      <LoginBackdrop />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="grow justify-center px-6"
        // Runtime insets and keyboard height can't be classes.
        contentContainerStyle={{
          paddingTop: insets.top + Spacing[8],
          // Extra bottom space when idle sits the form slightly above center.
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + Spacing[4] : insets.bottom + Spacing[24],
        }}>
        <View className="w-full max-w-[400px] self-center gap-8">
          <View className="items-center gap-3">
            <LogoMark size={120} />
            <View className="items-center gap-1">
              <ThemedText type="wordmark">ARTEMIS</ThemedText>
              <ThemedText type="eyebrow" tone="primary">
                Creatives Tracker
              </ThemedText>
            </View>
            <ThemedText tone="muted" className="max-w-[280px] text-center">
              {twoFactor === 'code'
                ? 'Enter the 6-digit code from your authenticator app.'
                : twoFactor === 'recovery'
                  ? 'Enter one of the recovery codes you saved when you set up two-factor authentication.'
                  : 'Track, review, and manage creatives from Artemis.'}
            </ThemedText>
          </View>

          <View className="gap-4">
            {twoFactor ? (
              <TextField
                key={twoFactor}
                label={twoFactor === 'code' ? 'Authentication code' : 'Recovery code'}
                icon={twoFactor === 'code' ? ShieldCheck : KeyRound}
                placeholder={twoFactor === 'code' ? '123456' : 'xxxxxxxxxx-xxxxxxxxxx'}
                value={twoFactorCode}
                onChangeText={(text) => {
                  setTwoFactorCode(text);
                  clearError('code');
                }}
                error={fieldErrors.code}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                {...(twoFactor === 'code'
                  ? {
                      keyboardType: 'number-pad',
                      maxLength: 6,
                      autoComplete: 'one-time-code',
                      textContentType: 'oneTimeCode',
                    }
                  : {})}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
            ) : (
              <>
                <TextField
                  label="Email"
                  icon={Mail}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    clearError('email');
                  }}
                  error={fieldErrors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <TextField
                  ref={passwordRef}
                  label="Password"
                  icon={Lock}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearError('password');
                  }}
                  error={fieldErrors.password}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      hitSlop={Spacing[1]}
                      onPress={() => setShowPassword((value) => !value)}
                      className="size-11 items-center justify-center">
                      <Icon as={showPassword ? Eye : EyeOff} className="text-chevron" />
                    </Pressable>
                  }
                />
              </>
            )}

            {formError && (
              <ThemedText type="meta" tone="rejected" accessibilityLiveRegion="polite">
                {formError}
              </ThemedText>
            )}

            <Button
              label={twoFactor ? 'Verify' : 'Log In'}
              trailingIcon={ArrowRight}
              loading={submitting}
              onPress={handleSubmit}
              className="mt-2"
            />

            {twoFactor && (
              <View className="flex-row items-center justify-between">
                <Pressable accessibilityRole="button" hitSlop={Spacing[3]} onPress={leaveTwoFactor}>
                  <ThemedText type="label" tone="muted">
                    Back
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={Spacing[3]}
                  onPress={() => {
                    setTwoFactor(twoFactor === 'code' ? 'recovery' : 'code');
                    setTwoFactorCode('');
                    setFieldErrors({});
                    setFormError(null);
                  }}>
                  <ThemedText type="label" tone="primary">
                    {twoFactor === 'code' ? 'Use a recovery code' : 'Use authenticator code'}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** Height of the on-screen keyboard, or 0 when it's hidden. */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS fires "will" events in sync with the keyboard animation; Android only has "did".
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext(LayoutAnimation.create(event.duration, 'keyboard'));
      }
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext(LayoutAnimation.create(event.duration, 'keyboard'));
      }
      setHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
