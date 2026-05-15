Feature: Simular Credito enviando valores máximos y minimos para la campaña

@simularCredito
Scenario Outline: Buscar clientes por perfil (1 login, N búsquedas)
  Given ingreso al login de urpipro
  When inicio sesion con el usuario "<userKey>"
  And ingreso a la bandeja de clientes
  And buscar y dar credito a los clientes del ADN "<userKey>"
  Then clientes con credito simulado

  Examples: CSV "resources/data/urpipro/users.csv"