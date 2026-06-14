from src.main import app


def test_openapi_contract_exposes_core_paths():
    schema = app.openapi()
    paths = schema["paths"]
    assert "/api/v1/search" in paths
    assert "post" in paths["/api/v1/search"]
    assert "/api/v1/estimate" in paths
    assert "/api/v1/stock" in paths
    assert "/api/v1/deals" in paths
    assert "/api/v1/settings" in paths


def test_openapi_search_request_includes_frontend_filters():
    schema = app.openapi()
    request_body = schema["paths"]["/api/v1/search"]["post"]["requestBody"]
    schema_ref = request_body["content"]["application/json"]["schema"]["$ref"]
    schema_name = schema_ref.rsplit("/", 1)[-1]
    search_schema = schema["components"]["schemas"][schema_name]
    properties = search_schema["properties"]
    assert "minPriceEur" in properties
    assert "maxPriceEur" in properties
    assert "minRating" in properties
    assert "maxDeliveryDays" in properties
