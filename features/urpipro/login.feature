Feature: Login

  @urpiproLogin
  Scenario Outline: Successful login
    Given ingreso al login de urpipro
    When inicio sesion con el usuario "<userKey>"
    Then el sistema me debe llevar a la pantalla de gestion de clientes
    Examples: CSV "resources/data/urpipro/users.csv"
