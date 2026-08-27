export function enableDevToolsProtection(): () => void {
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    // const blocked =
    //   event.key === "F12" ||
    //   (event.ctrlKey &&
    //     event.shiftKey &&
    //     (key === "i" || key === "j" || key === "c")) ||
    //   (event.ctrlKey && key === "u");

    const blocked = false;

    if (blocked) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener(
    "contextmenu",
    handleContextMenu
  );

  document.addEventListener(
    "keydown",
    handleKeyDown,
    true
  );

  return () => {
    document.removeEventListener(
      "contextmenu",
      handleContextMenu
    );

    document.removeEventListener(
      "keydown",
      handleKeyDown,
      true
    );
  };
}