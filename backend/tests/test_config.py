from app.core.config import Settings


def test_keep_alive_enabled_defaults_to_false() -> None:
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql://localhost/test",
        DIRECT_URL="postgresql://localhost/test",
        JWT_SECRET="test-jwt-secret-key-32chars-min!",
    )

    assert settings.KEEP_ALIVE_ENABLED is False


def test_keep_alive_enabled_reads_environment_variable(monkeypatch) -> None:
    monkeypatch.setenv("KEEP_ALIVE_ENABLED", "true")
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql://localhost/test",
        DIRECT_URL="postgresql://localhost/test",
        JWT_SECRET="test-jwt-secret-key-32chars-min!",
    )

    assert settings.KEEP_ALIVE_ENABLED is True
