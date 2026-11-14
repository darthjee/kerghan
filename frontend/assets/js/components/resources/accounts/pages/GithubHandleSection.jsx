import { useEffect, useMemo, useState } from 'react';
import GithubHandleController, { INITIAL_STATE } from './controllers/GithubHandleController.js';
import GithubHandleHelper from './helpers/GithubHandleHelper.jsx';

/**
 * Build the mount-time load effect: triggers `controller.load()` once. Extracted as a plain
 * function so it can be exercised directly in tests without a React renderer.
 *
 * @param {GithubHandleController} controller - The section's controller.
 * @returns {Function} Effect callback.
 */
export function buildLoadEffect(controller) {
  return () => {
    controller.load();
  };
}

/**
 * GitHub handle section of the My Account page, with its own state and controller, independent
 * of the username / email / password form.
 *
 * @returns {React.ReactElement} The rendered section.
 */
export default function GithubHandleSection() {
  const [state, setState] = useState(INITIAL_STATE);
  const controller = useMemo(() => new GithubHandleController(setState), []);

  useEffect(() => buildLoadEffect(controller)(), [controller]);

  return GithubHandleHelper.render(state, {
    onSubmit: (event) => {
      event.preventDefault();
      return controller.save(state.handle);
    },
    onChange: (event) => controller.patch({ handle: event.target.value }),
  });
}
