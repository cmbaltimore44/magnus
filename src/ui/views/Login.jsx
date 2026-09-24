import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text, useInput, useWindowSize } from 'ink';
import TextInput from 'ink-text-input';
import { useCapture } from '../context.js';
import { requestCode, verifyCode } from '../../lib/auth.js';
import { Banner } from '../components/Banner.jsx';

export function Login({ onAuthenticated }) {
  useCapture();
  const { columns } = useWindowSize();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useInput((_input, key) => {
    if (key.escape && step === 'code' && !busy) {
      setStep('email');
      setCode('');
      setError(null);
    }
  });

  const submitEmail = async (value) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestCode(trimmed);
      setEmail(trimmed);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (value) => {
    const trimmed = value.replace(/\s+/g, '');
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const session = await verifyCode(email, trimmed);
      onAuthenticated(session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Banner columns={columns} />
      <Text bold>Sign in to Life Tracker</Text>
      <Text color={C.muted}>One-time setup — your session is kept in the macOS Keychain after this. (ctrl+c quits)</Text>
      <Box marginTop={1} flexDirection="column">
        {step === 'email' ? (
          <Box>
            <Text color={C.accent}>Email: </Text>
            <TextInput value={email} onChange={setEmail} onSubmit={submitEmail} placeholder="you@example.com" />
          </Box>
        ) : (
          <>
            <Text>
              Check <Text bold>{email}</Text> for a 6-digit code.
            </Text>
            <Box>
              <Text color={C.accent}>Code: </Text>
              <TextInput value={code} onChange={setCode} onSubmit={submitCode} placeholder="123456" />
            </Box>
            <Text color={C.muted}>esc to change email</Text>
          </>
        )}
        {busy ? <Text color={C.muted}>Working…</Text> : null}
        {error ? <Text color={C.danger}>{error}</Text> : null}
      </Box>
    </Box>
  );
}
