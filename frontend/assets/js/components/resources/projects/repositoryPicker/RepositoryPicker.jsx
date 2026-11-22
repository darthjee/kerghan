import { useEffect, useMemo, useState } from 'react';
import RepositoryPickerController from './RepositoryPickerController.js';
import RepositoryPickerHelper from './RepositoryPickerHelper.jsx';

/**
 * Build the mount-time effect: loads the unsearched list and returns a cleanup disposing the
 * controller's timer on unmount.
 *
 * @param {RepositoryPickerController} controller - The picker's controller.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export function buildPickerEffect(controller) {
  return () => {
    controller.start();
    return () => controller.dispose();
  };
}

/**
 * Repository picker: a search box over the caller's added repositories, used by the creation
 * form and by project management. Picking a result shows its `owner/name` with a Clear button;
 * with no added repository at all it shows "Add a repository first", linking to
 * `#/repositories`.
 *
 * @param {{selected: ({githubId: number, fullName: string}|null), onChange: Function,
 *   inputId: (string|undefined)}} props - The chosen repository (`null` for none), the callback
 *   receiving the new choice (a `{githubId, fullName}` or `null` on Clear) and the search
 *   box's id, for its label.
 * @returns {React.ReactElement} The rendered picker.
 */
export default function RepositoryPicker({ selected, onChange, inputId }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [noneAdded, setNoneAdded] = useState(false);
  const [error, setError] = useState(null);

  const controller = useMemo(
    () => new RepositoryPickerController({
      setSearch, setResults, setNoneAdded, setError,
    }),
    [],
  );

  useEffect(() => buildPickerEffect(controller)(), [controller]);

  return RepositoryPickerHelper.render(
    {
      selected, search, results, noneAdded, error,
    },
    {
      onClear: () => onChange(null),
      onPick: (repository) => () => onChange({ githubId: repository.githubId, fullName: repository.fullName }),
      onSearchChange: (event) => controller.changeSearch(event.target.value),
    },
    inputId,
  );
}
