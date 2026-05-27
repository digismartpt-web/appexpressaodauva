import { useCaveSettings } from '../hooks/useCaveSettings';

export function Privacy() {
  const { settings } = useCaveSettings();

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-primary-800 mb-8">CONDIÇÕES GERAIS DE VENDA E DE UTILIZAÇÃO (CGV/CGU)</h1>

      <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
        <section>
          <p className="font-semibold text-primary-800 mb-2">
            Versão: 1.2 (Comissão negociada até à data, revisável caso a caso a partir de 10% sobre os produtos)
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 1: OBJETO DO SERVIÇO</h2>
          <p className="text-primary-600">
            O Prestador fornece uma solução de software SaaS de recolha de encomendas. O Prestador não intervém na atividade comercial do Cliente nem na entrega física, as quais permanecem sob a responsabilidade exclusiva do Cliente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 2: PROPRIEDADE INTELECTUAL</h2>
          <p className="text-primary-600">
            A Aplicação (código, design, interface) é propriedade exclusiva do Prestador. O Cliente beneficia de um direito de utilização revogável.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 3: CONDIÇÕES FINANCEIRAS (A SUA PROTEÇÃO)</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-primary-800">Taxa de comissão:</h3>
              <p className="text-primary-600">O Cliente compromete-se a pagar ao Prestador uma comissão fixa (assinada e validada no contrato) sobre cada encomenda.</p>
            </div>
            <div>
              <h3 className="font-medium text-primary-800">Base de cálculo:</h3>
              <p className="text-primary-600">A comissão aplica-se ao conjunto de todos os produtos e serviços vendidos através do SaaS.</p>
            </div>
            <div>
              <h3 className="font-medium text-primary-800">Independência dos pagamentos:</h3>
              <p className="text-primary-600">A comissão é devida ao Prestador a partir da validação da encomenda na Aplicação. Os não pagamentos dos clientes finais ou os gestos comerciais do restaurador não dão direito a qualquer dedução de comissão para o Prestador.</p>
            </div>
            <div>
              <h3 className="font-medium text-primary-800">Faturação:</h3>
              <p className="text-primary-600">É emitida uma fatura de comissões todas as semanas com base no relatório de vendas gerado pela ferramenta.</p>
            </div>
            <div>
              <h3 className="font-medium text-primary-800">Pagamento:</h3>
              <p className="text-primary-600">O montante das comissões é exigível à receção da fatura.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 4: RESPONSABILIDADE TÉCNICA E OPERACIONAL</h2>
          <p className="text-primary-600">
            <strong>Prestador:</strong> Responsável unicamente pela disponibilidade técnica da ferramenta.<br />
            <strong>Cliente:</strong> Único responsável pelos produtos entregues, pela higiene, pelo respeito dos alergénios e pela conformidade legal da sua venda. O Prestador não poderá ser processado por qualquer dano relacionado com o consumo dos produtos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 5: SUSPENSÃO POR FALTA DE PAGAMENTO</h2>
          <p className="text-primary-600">
            Em caso de não pagamento das comissões no prazo previsto, o Prestador reserva-se o direito de desativar o acesso ao módulo de encomenda e ao espaço Admin no prazo de 48 horas após notificação prévia que tenha ficado sem resposta.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 6: PROTEÇÃO DE DADOS E RGPD</h2>
          <p className="text-primary-600">
            O Cliente é o responsável legal pelos dados dos seus próprios clientes. O Prestador assegura o armazenamento seguro e proíbe-se de utilizar os dados nominativos dos clientes finais para sua própria conta.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 7: MANUTENÇÃO E DISPONIBILIDADE</h2>
          <p className="text-primary-600">
            A Aplicação está acessível 24h/24h, salvo períodos de manutenção ou avarias nos alojadores terceiros (Supabase, Google, Hostinger, Coolify etc.).
            O Prestador não poderá ser responsabilizado por qualquer perda de exploração ou lucros cessantes resultantes de uma interrupção temporária do serviço, qualquer que seja a sua duração.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 8: RESCISÃO</h2>
          <p className="text-primary-600">
            Contrato sem compromisso de duração, rescindível por e-mail com um pré-aviso de 1 mês. Todas as comissões sobre as vendas realizadas até ao último dia do pré-aviso são devidas.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-primary-800 mb-4">ARTIGO 9: FORÇA MAIOR</h2>
          <p className="text-primary-600">
            A responsabilidade do Prestador não poderá ser comprometida em caso de força maior ou de factos independentes da sua vontade (ciberataques, cortes de rede internet nacional, raios sobre os data centers).
          </p>
        </section>

        <section className="pt-8 border-t border-primary-100">
          <p className="text-sm text-primary-500 italic">
            Para qualquer questão, pode contactar-nos através do endereço: digismartpt@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}