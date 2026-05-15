Feature: Gestión de clientes

@validarClientesPorADN
Scenario Outline: Buscar clientes por perfil (1 login, N búsquedas)
  Given ingreso al login de urpipro
  When inicio sesion con el usuario "<userKey>"
  And ingreso a la bandeja de clientes
  And busco y valido los clientes del usuario "<userKey>"
  Then debo ver resultados de clientes

  Examples: CSV "resources/data/urpipro/users.csv"